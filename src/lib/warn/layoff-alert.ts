import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { contactStrength } from '@/lib/crm/contact-strength'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import { ALERT_HOLD_HOURS, alertBody, alertReadiness, alertSubject, shouldAlert, type AlertInput, type LayoffKind } from './layoff-alert-rules'
import { enrichLayoffHr } from './layoff-hr-enrich'
import { layoffPeople } from './layoff-alert-people'
import { inferHq } from './layoff-hq-state'
import { buildLocalPicture, classifyLayoffIndustry } from './layoff-context'
import { pictureRows, placeFromHeadlines, talkingPoints, type Audience } from './layoff-picture'

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
    if (!process.env.RESEND_API_KEY) return false
    if (sentThisRun >= MAX_ALERTS_PER_RUN) { await markHeld(l.noticeId); return false } // a later run sends it

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
      select: { state: true, county: true, address: true, workforceBoardId: true, promotedOrgId: true, companyId: true, industry: true, alertSentAt: true, alertHeldAt: true, alertGaveUpAt: true,
        costLowUsd: true, costHighUsd: true, costNote: true, outplacementProvider: true, outplacementNote: true },
    }).catch(() => null)
    if (notice?.alertSentAt || notice?.alertGaveUpAt) return false
    // Find the people to call now, so the email is not empty: one Hunter search for a company with no head of HR on file.
    // The Hunter search is spent once, on the first attempt; a retry only re-reads what the CRM has gained since.
    const firstAttempt = !notice?.alertHeldAt
    const orgId = (firstAttempt ? await enrichLayoffHr(l.employer, org?.id ?? notice?.promotedOrgId ?? null) : null) ?? org?.id ?? notice?.promotedOrgId ?? null
    const orgState = orgId ? (await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { usState: true } }))?.usState ?? null : null
    // Where the layoff is, what industry it is in, and what the local job market looks like. A news story
    // rarely names a place, so look in this order: the filing, the headlines, the CRM record, then the company's
    // SEC filings (headquarters) and the states it has filed WARN notices in.
    const headlines = (await prisma.layoffNewsMention.findMany({ where: { noticeId: l.noticeId }, select: { headline: true } }).catch(() => [])).map((m) => m.headline)
    const company = notice?.companyId ? await prisma.company.findUnique({ where: { id: notice.companyId }, select: { industry: true } }).catch(() => null) : null
    let state = notice?.state ?? null
    let city: string | null = null
    let placeNote: string | null = null
    if (!state) {
      const h = placeFromHeadlines(headlines)
      if (h) { state = h.state; city = h.city; placeNote = 'from news coverage' }
    }
    if (!state && orgState) { state = orgState; placeNote = 'from the CRM record' }
    const needHq = !state || (!company?.industry && !notice?.industry)
    const hq = needHq ? await inferHq(l.normalizedEmployer) : null
    if (!state && hq?.state) {
      state = hq.state; city = hq.city
      placeNote = hq.source === 'sec' ? 'company headquarters, from SEC filings' : 'where it has filed WARN notices'
    }
    const industry = await classifyLayoffIndustry({
      employer: l.employer, companyIndustry: company?.industry ?? null, naics: notice?.industry ?? null, sicDescription: hq?.sicDescription ?? null, allowModel: firstAttempt,
    })
    const picture = await buildLocalPicture({ employer: l.employer, employees: l.employees, state, county: notice?.county ?? null, industryKey: industry?.key ?? null })

    const related = await layoffPeople(orgId, {
      state, county: notice?.county ?? null, city, address: notice?.address ?? null, workforceBoardId: notice?.workforceBoardId ?? null, industryKey: industry?.key ?? null,
    }).catch((e) => { console.error('Layoff alert people failed for', l.employer, e); return null })
    const PARTNER: Record<string, Audience> = { rapid_response: 'rapid_response', workforce_board: 'workforce_board', job_centers: 'job_centers', economic_development: 'economic_development' }
    const groups = related?.groups.map((g) => (PARTNER[g.key] ? { ...g, pitch: talkingPoints(picture, PARTNER[g.key]) ?? undefined } : g)) ?? []
    if (related) {
      input.groups = groups
      const where = [city ?? notice?.county, state].filter(Boolean).join(', ')
      input.place = where ? `${where}${placeNote ? ` (${placeNote})` : ''}` : related.placeLabel
    }
    input.costs = notice ?? undefined
    input.picture = { rows: pictureRows(picture, { industryLabel: industry?.label ?? null, industrySource: industry?.source ?? null }) }

    // Only email once the alert is populated; otherwise hold it and look again on the next run.
    const readiness = alertReadiness(groups, state)
    if (!readiness.ready) {
      await markHeld(l.noticeId)
      captureServerEvent('cron', 'layoff_alert_held', { employer: l.employer, employees: l.employees, missing: readiness.missing, state, industry: industry?.label ?? null })
      return false
    }

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
    await prisma.warnNotice.update({ where: { id: l.noticeId }, data: { alertSentAt: new Date() } }).catch(() => {})
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

/** Remembers when an alert was first held, so the 72-hour clock starts once. */
async function markHeld(noticeId: string): Promise<void> {
  await prisma.warnNotice.updateMany({ where: { id: noticeId, alertHeldAt: null }, data: { alertHeldAt: new Date() } }).catch(() => {})
}

/**
 * Looks again at every held alert: the CRM may have gained the HR contact or the
 * place since, from the contact lookups, the primary-contact sweep, or by hand.
 * Sends the ones now populated; after 72 hours still short, drops the alert
 * without emailing (the 7 AM digest still lists the layoff).
 */
export async function retryHeldLayoffAlerts(now = new Date()): Promise<{ retried: number; sent: number; gaveUp: number }> {
  const out = { retried: 0, sent: 0, gaveUp: 0 }
  const held = await prisma.warnNotice.findMany({
    where: { alertHeldAt: { not: null }, alertSentAt: null, alertGaveUpAt: null, dismissedAt: null },
    orderBy: { alertHeldAt: 'asc' },
    take: 20,
  })
  for (const n of held) {
    if (now.getTime() - (n.alertHeldAt?.getTime() ?? now.getTime()) > ALERT_HOLD_HOURS * 3_600_000) {
      await prisma.warnNotice.update({ where: { id: n.id }, data: { alertGaveUpAt: now } })
      captureServerEvent('cron', 'layoff_alert_gave_up', { employer: n.employer, employees: n.employees })
      out.gaveUp++
      continue
    }
    const kind: LayoffKind = n.source === 'WARN_FILING' ? 'warn' : /^SEC 8-K/i.test(n.layoffType ?? '') ? 'sec' : 'news'
    const percent = n.layoffType?.match(/(\d{1,3}(?:\.\d+)?)% of staff/)?.[1]
    out.retried++
    const sent = await alertNewLayoff({
      noticeId: n.id, employer: n.employer, normalizedEmployer: n.normalizedEmployer, employees: n.employees,
      percent: percent ? parseFloat(percent) : null, kind, confirmed: kind !== 'news' || !/unconfirmed/i.test(n.layoffType ?? ''),
      sourceUrl: n.sourceUrl,
    })
    if (sent) out.sent++
  }
  return out
}
