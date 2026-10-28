import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { buildLocalPicture } from '@/lib/warn/layoff-context'
import { COMPOSE_ACCOUNT, draftFor, draftKind, greetingFor } from '@/lib/warn/layoff-alert-drafts'
import { employerSlug } from '@/lib/warn/layoff-pages'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 30
const SITE = 'https://launchyournextchapter.com'
const HEAD_HR = /chief (human|people|talent)|chro|head of (hr|human|people)|(vp|vice president|svp|evp).*(hr|human|people)/i

/**
 * Opens Gmail with the layoff note written for this person, from their employer's most recent notice. A redirect, so the list pages stay
 * light and the draft is built only when you ask for it. Nothing is sent.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const person = await prisma.crmPerson.findFirst({
    where: { id, deletedAt: null },
    select: {
      fullName: true, email: true, guessedEmail: true,
      affiliations: { orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 1, select: { title: true, org: { select: { name: true, usState: true } } } },
    },
  })
  const to = person?.email ?? person?.guessedEmail
  const aff = person?.affiliations[0]
  if (!person || !to || !aff) return Response.redirect(new URL(`/support/admin/crm/people/${id}`, req.url), 302)

  const employer = aff.org.name
  const notice = await prisma.warnNotice.findFirst({
    where: { dismissedAt: null, employer: { equals: employer, mode: 'insensitive' } },
    orderBy: { noticeDate: 'desc' },
    select: { id: true, employees: true, state: true, county: true },
  })
  const state = notice?.state ?? (aff.org.usState && aff.org.usState.length === 2 ? aff.org.usState : null)
  const picture = await buildLocalPicture({ employer, employees: notice?.employees ?? null, state, county: notice?.county ?? null, industryKey: null })
  const title = aff.title ?? null
  const kind = HEAD_HR.test(title ?? '') ? 'head_hr' : draftKind('hr_team', title)
  if (!kind) return Response.redirect(new URL(`/support/admin/crm/people/${id}`, req.url), 302)
  const draft = draftFor(kind, { name: person.fullName, title, org: employer, email: to, phone: null, strength: null, href: null, personId: id, greet: greetingFor(person.fullName) }, { picture, peoplePage: `${SITE}/network/company/${employerSlug(employer, null)}`, localPage: null })
  captureServerEvent(admin.email ?? 'admin', 'followup_layoff_email_opened', { personId: id, kind, hasNotice: !!notice })
  return Response.redirect(gmailComposeHref(to, draft.subject, draft.body, COMPOSE_ACCOUNT), 302)
}
