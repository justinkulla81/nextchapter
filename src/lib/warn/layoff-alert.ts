import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { contactStrength } from '@/lib/crm/contact-strength'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import { alertBody, alertSubject, shouldAlert, type AlertInput, type LayoffKind } from './layoff-alert-rules'
import { layoffPeople } from './layoff-alert-people'

/** The only recipient: Justin's NextChapter inbox, never a personal address. */
const ALERT_TO = 'justin@launchyournextchapter.com'
const SITE = 'https://launchyournextchapter.com'
/** A company we already alerted on this recently is not alerted on again. */
const REPEAT_DAYS = 7
/** A newly added state source can file many 250+ notices at once; past this a run stops mailing. */
const MAX_ALERTS_PER_RUN = 10
let sentThisRun = 0

export interface NewLayoff {
  noticeId: string
  employer: string
  normalizedEmployer: string
  employees: number | null
  percent: number | null
  kind: LayoffKind
  confirmed: boolean
  sourceUrl: string | null
  contactsFound?: number
}

/**
 * One email, the moment a new layoff is 250+ jobs or the employer is already in
 * the CRM, instead of the next 7 AM digest. Called once when a notice is
 * created, so each layoff alerts once; a second notice for the same company in
 * a week (a multi-site WARN filing) does not alert again. Never throws: an
 * alert that fails must not stop a layoff from being filed.
 */
export async function alertNewLayoff(l: NewLayoff): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY || sentThisRun >= MAX_ALERTS_PER_RUN) return false

    const org = await prisma.crmOrganization.findUnique({
      where: { canonicalNameNormalized: l.normalizedEmployer },
      select: { id: true },
    })
    const people = org
      ? await prisma.crmPerson.findMany({
          where: { deletedAt: null, affiliations: { some: { orgId: org.id, isCurrent: true } } },
          select: { warmth: true, connectedAt: true, linkedinDegree: true, firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true },
        })
      : []
    const warm = people.filter((p) => ['hot', 'warm'].includes(contactStrength(p) ?? '')).length
    const input: AlertInput = {
      employer: l.employer, employees: l.employees, percent: l.percent, kind: l.kind, confirmed: l.confirmed,
      inCrm: !!org, people: people.length, warm, contactsFound: l.contactsFound ?? 0,
    }
    if (!shouldAlert(input)) return false

    // Everyone tied to this layoff, by role. A failure here sends the shorter email, not none.
    const notice = await prisma.warnNotice.findUnique({
      where: { id: l.noticeId },
      select: { state: true, county: true, address: true, workforceBoardId: true, promotedOrgId: true },
    }).catch(() => null)
    const related = await layoffPeople(org?.id ?? notice?.promotedOrgId ?? null, {
      state: notice?.state ?? null, county: notice?.county ?? null, address: notice?.address ?? null, workforceBoardId: notice?.workforceBoardId ?? null,
    }).catch((e) => { console.error('Layoff alert people failed for', l.employer, e); return null })
    if (related) { input.groups = related.groups; input.place = related.placeLabel }

    const sibling = await prisma.warnNotice.count({
      where: {
        normalizedEmployer: l.normalizedEmployer, id: { not: l.noticeId },
        fetchedAt: { gte: new Date(Date.now() - REPEAT_DAYS * 86_400_000) },
      },
    })
    if (sibling > 0) return false

    const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: ALERT_TO,
      subject: alertSubject(input),
      html: withAudienceHtml('admin', alertBody(input, {
        source: l.sourceUrl,
        org: org ? `${SITE}/support/admin/crm/organizations/${org.id}` : null,
        notices: `${SITE}/support/admin/crm/warn`,
      })),
    })
    if (error) {
      console.error('Layoff alert not sent for', l.employer, error)
      return false
    }
    sentThisRun++
    captureServerEvent('cron', 'layoff_alert_sent', {
      employer: l.employer, kind: l.kind, employees: l.employees, percent: l.percent,
      inCrm: !!org, warm, confirmed: l.confirmed,
    })
    return true
  } catch (e) {
    console.error('Layoff alert failed for', l.employer, e)
    return false
  }
}
