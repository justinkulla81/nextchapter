// "Waiting for you": what each office has to approve or follow up on. The
// same list shows on the office's home and goes out in its weekly email.

import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import type { CheckInKind, InstitutionUserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pendingCheckIns } from './checkins'

const EARLY: CheckInKind[] = ['M6', 'M18', 'M24']

export type Office = 'alumni' | 'career'

export type Item = { key: string; text: string; href: string }

export async function waitingFor(id: string, office: 'alumni' | 'career', base: string): Promise<Item[]> {
  const items: Item[] = []
  if (office === 'alumni') {
    const [layoffs, pending] = await Promise.all([
      prisma.layoffMatch.count({ where: { institutionId: id, outreachStatus: 'NEW' } }),
      pendingCheckIns(id),
    ])
    if (layoffs) items.push({ key: 'layoffs', text: `${layoffs} ${layoffs === 1 ? 'alum' : 'alumni'} at companies with new layoff notices`, href: `${base}/layoffs` })
    const annual = pending.find((p) => p.kind === 'CUSTOM')?.count ?? 0
    if (annual) items.push({ key: 'annual', text: `${annual.toLocaleString()} annual check-ins ready to send`, href: `${base}/outreach` })
  } else {
    const since = new Date(Date.now() - 30 * 86_400_000)
    const [pending, followUps] = await Promise.all([
      pendingCheckIns(id),
      prisma.checkIn.count({
        where: { member: { institutionId: id }, status: 'RESPONDED', respondedAt: { gte: since }, OR: [{ responseJson: { path: ['answer'], equals: 'looking' } }, { responseJson: { path: ['answer'], equals: 'laid_off' } }] },
      }),
    ])
    const early = pending.filter((p) => EARLY.includes(p.kind)).reduce((n, p) => n + p.count, 0)
    if (early) items.push({ key: 'early', text: `${early} early-career check-ins ready to send`, href: `${base}/checkins` })
    if (followUps) items.push({ key: 'followups', text: `${followUps} ${followUps === 1 ? 'alum' : 'alumni'} asked for help in a check-in`, href: `${base}/checkins` })
  }
  return items
}


function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

const OFFICE_ROLES: Record<Office, InstitutionUserRole> = { alumni: 'ALUMNI_RELATIONS', career: 'CAREER_SERVICES' }
const OFFICE_NAMES: Record<Office, string> = { alumni: 'Alumni Relations', career: 'Career Services' }

// Monday's email to each office: only when something is waiting, only to
// real colleges (a demo never emails staff). An office with no one in its
// role goes to the college admins instead.
export async function sendWeeklyDigests(): Promise<{ emails: number; colleges: number }> {
  const colleges = await prisma.institution.findMany({
    where: { isDemo: false },
    select: { id: true, slug: true, name: true, users: { where: { acceptedAt: { not: null }, revokedAt: null }, select: { invitedEmail: true, role: true } } },
  })
  const resend = process.env.RESEND_API_KEY ? createResend(process.env.RESEND_API_KEY) : null
  let emails = 0
  let reached = 0
  for (const c of colleges) {
    let any = false
    for (const office of ['alumni', 'career'] as Office[]) {
      const base = `${appUrl()}/i/${c.slug}/${office}`
      const items = await waitingFor(c.id, office, base)
      if (!items.length) continue
      const own = c.users.filter((u) => u.role === OFFICE_ROLES[office])
      const to = [...new Set((own.length ? own : c.users.filter((u) => u.role === 'INSTITUTION_ADMIN')).map((u) => u.invitedEmail))]
      if (!to.length || !resend) continue
      const text = [
        `${OFFICE_NAMES[office]}, here's what's waiting in ${c.name}'s NextChapter this week:`,
        '',
        ...items.map((i) => `• ${i.text}: ${i.href}`),
        '',
        `Everything else runs on its own. Open your workspace: ${base}`,
      ].join('\n')
      const r = await resend.emails.send({ from: 'NextChapter <support@launchyournextchapter.com>', to, subject: `${items.length} waiting for ${OFFICE_NAMES[office]} this week`, text })
      if (!r.error) {
        emails++
        any = true
      }
    }
    if (any) reached++
  }
  return { emails, colleges: reached }
}
