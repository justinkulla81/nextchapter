import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { contactStrength } from '@/lib/crm/contact-strength'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import {
  ALERT_HOLD_HOURS, MAX_FULL_ALERTS_PER_RUN, alertBody, alertReadiness, alertSubject, digestBody, digestSubject, noticeKind, officialBody, officialSubject, shouldAlert,
  type AlertInput, type DigestItem, type LayoffKind, type OfficialItem,
} from './layoff-alert-rules'
import { enrichLayoffHr } from './layoff-hr-enrich'
import { layoffPeople } from './layoff-alert-people'
import { withComposeLinks } from './layoff-alert-drafts'
import { loadAlertSources } from './layoff-alert-sources'
import { draftContext } from './layoff-alert-links'
import { inferHq } from './layoff-hq-state'
import { buildLocalPicture, classifyLayoffIndustry } from './layoff-context'
import { pictureRows, placeFromHeadlines, talkingPoints, type Audience } from './layoff-picture'

/** The only recipient: Justin's NextChapter inbox, never a personal address. */
const ALERT_TO = 'justin@launchyournextchapter.com'
const SITE = 'https://launchyournextchapter.com'
/** A company we already alerted on this recently is not alerted on again. */
const REPEAT_DAYS = 7

/**
 * One cron run: the first MAX_FULL_ALERTS_PER_RUN alerts go out in full; the rest, and every "now official" note, leave
 * together in one email when the run ends. Outside a run (an admin filing one layoff by hand) there is no cap and no queue.
 * Runs nest, so a run that calls another still flushes once.
 */
interface AlertRun { full: number; queue: (DigestItem & { noticeId: string })[]; official: OfficialItem[] }
let run: AlertRun | null = null
let runDepth = 0

export async function withAlertRun<T>(fn: () => Promise<T>): Promise<T> {
  if (runDepth++ === 0) run = { full: 0, queue: [], official: [] }
  try {
    return await fn()
  } finally {
    if (--runDepth === 0) await flushAlertRun()
  }
}

async function flushAlertRun(): Promise<void> {
  const r = run
  run = null
  if (!r || !process.env.RESEND_API_KEY) return
  const resend = createResend(process.env.RESEND_API_KEY, 'admin')
  const notices = `${SITE}/support/admin/crm/warn`
  if (r.queue.length) {
    const items = [...r.queue].sort((a, b) => (b.employees ?? 0) - (a.employees ?? 0))
    try {
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>', to: ALERT_TO,
        subject: digestSubject(items), html: withAudienceHtml('admin', digestBody(items, { notices })),
      })
      if (error) console.error('Layoff digest not sent:', error) // the notices stay held, so the hourly retry still sends them
      else {
        await prisma.warnNotice.updateMany({ where: { id: { in: items.map((i) => i.noticeId) } }, data: { alertSentAt: new Date() } }).catch(() => {})
        captureServerEvent('cron', 'layoff_alert_digest_sent', { layoffs: items.length, employers: items.slice(0, 10).map((i) => i.employer) })
      }
    } catch (e) {
      console.error('Layoff digest failed:', e)
    }
  }
  if (r.official.length) {
    try {
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>', to: ALERT_TO,
        subject: officialSubject(r.official), html: withAudienceHtml('admin', officialBody(r.official, { notices })),
      })
      if (error) console.error('Layoff official note not sent:', error)
      else captureServerEvent('cron', 'layoff_now_official_sent', { layoffs: r.official.length, employers: r.official.slice(0, 10).map((i) => i.employer), kinds: r.official.map((i) => i.kind) })
    } catch (e) {
      console.error('Layoff official note failed:', e)
    }
  }
}

/** Tells Justin a layoff he already heard about from the news now has a filing. Queued inside a run, sent at once outside one. */
export async function announceOfficial(item: OfficialItem): Promise<void> {
  if (run) { run.official.push(item); return }
  if (!process.env.RESEND_API_KEY) return
  await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>', to: ALERT_TO,
    subject: officialSubject([item]), html: withAudienceHtml('admin', officialBody([item], { notices: `${SITE}/support/admin/crm/warn` })),
  }).catch((e) => console.error('Layoff official note failed:', e))
}

/** Only a sibling that was actually emailed counts: one that was held or skipped must not silence a later, larger notice. */
const emailedSibling = (normalizedEmployer: string, noticeId: string) =>
  prisma.warnNotice.count({
    where: { normalizedEmployer, id: { not: noticeId }, alertSentAt: { not: null }, fetchedAt: { gte: new Date(Date.now() - REPEAT_DAYS * 86_400_000) } },
  })

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
export async function alertNewLayoff(l: NewLayoff, opts: { sendThin?: boolean } = {}): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) return false
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
      select: { division: true, state: true, county: true, address: true, workforceBoardId: true, promotedOrgId: true, companyId: true, industry: true, alertSentAt: true, alertHeldAt: true, alertGaveUpAt: true,
        costLowUsd: true, costHighUsd: true, costNote: true, outplacementProvider: true, outplacementNote: true },
    }).catch(() => null)
    if (notice?.alertSentAt || notice?.alertGaveUpAt) return false
    // Past the run's cap: no contact search, no drafts. It goes in the digest at the end of the run, and stays held until then in case that email fails.
    if (run && run.full >= MAX_FULL_ALERTS_PER_RUN) {
      if (await emailedSibling(l.normalizedEmployer, l.noticeId) > 0) return false
      await markHeld(l.noticeId)
      run.queue.push({
        noticeId: l.noticeId, employer: l.employer, employees: l.employees, percent: l.percent, kind: l.kind, confirmed: l.confirmed,
        inCrm: !!org, people: people.length, warm, orgUrl: org ? `${SITE}/support/admin/crm/organizations/${org.id}` : null,
      })
      return false
    }
    input.division = notice?.division ?? null
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
      // A "Write email" button on each contact with an address: Gmail compose from justin@launchyournextchapter.com, a note written for their role. A failure here sends the alert without buttons.
      input.groups = await draftContext(picture, l.employer, state, notice?.county ?? null, l.noticeId).then((x) => withComposeLinks(groups, x)).catch((e) => { console.error('Layoff alert drafts failed for', l.employer, e); return groups })
      const where = [city ?? notice?.county, state].filter(Boolean).join(', ')
      input.place = where ? `${where}${placeNote ? ` (${placeNote})` : ''}` : related.placeLabel
    }
    input.costs = notice ?? undefined
    input.picture = { rows: pictureRows(picture, { industryLabel: industry?.label ?? null, industrySource: industry?.source ?? null }) }
    input.sources = await loadAlertSources(l.noticeId, l.sourceUrl, l.kind === 'warn' ? 'WARN filing' : l.kind === 'sec' ? 'SEC 8-K filing' : 'Notice')

    const sibling = await emailedSibling(l.normalizedEmployer, l.noticeId)
    if (sibling > 0) {
      // A held notice that a sibling already covered is finished; closing it keeps the hourly retry list short.
      if (notice?.alertHeldAt) await prisma.warnNotice.update({ where: { id: l.noticeId }, data: { alertGaveUpAt: new Date() } }).catch(() => {})
      return false
    }

    // Try to have every contact before sending: hold a short while and retry hourly as the lookups fill in.
    // Once the hold runs out, send what we have and list what is missing at the top of the email; never drop it.
    const readiness = alertReadiness(groups, state)
    if (!readiness.ready) {
      if (!opts.sendThin) {
        await markHeld(l.noticeId)
        captureServerEvent('cron', 'layoff_alert_held', { noticeId: l.noticeId, employer: l.employer, employees: l.employees, missing: readiness.missing })
        return false
      }
      input.gaps = readiness.missing
    }

    const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      to: ALERT_TO,
      subject: alertSubject(input),
      html: withAudienceHtml('admin', alertBody(input, {
        source: null,
        org: org ? `${SITE}/support/admin/crm/organizations/${org.id}` : null,
        notices: `${SITE}/support/admin/crm/warn`,
      })),
    })
    if (error) {
      console.error('Layoff alert not sent for', l.employer, error)
      return false
    }
    if (run) run.full++
    await prisma.warnNotice.update({ where: { id: l.noticeId }, data: { alertSentAt: new Date() } }).catch(() => {})
    captureServerEvent('cron', 'layoff_alert_sent', {
      employer: l.employer, kind: l.kind, employees: l.employees, percent: l.percent,
      inCrm: !!org, warm, confirmed: l.confirmed, gaps: input.gaps ?? [],
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
 * Sends the ones now populated; once the hold (ALERT_HOLD_HOURS) runs out, sends
 * the alert anyway with the missing pieces listed at the top.
 */
export const retryHeldLayoffAlerts = (now = new Date()) => withAlertRun(() => retryHeld(now))

async function retryHeld(now: Date): Promise<{ retried: number; sent: number; sentThin: number }> {
  const out = { retried: 0, sent: 0, sentThin: 0 }
  const held = await prisma.warnNotice.findMany({
    where: { alertHeldAt: { not: null }, alertSentAt: null, alertGaveUpAt: null, dismissedAt: null },
    orderBy: { alertHeldAt: 'asc' },
    take: 20,
  })
  for (const n of held) {
    const sendThin = now.getTime() - (n.alertHeldAt?.getTime() ?? now.getTime()) >= ALERT_HOLD_HOURS * 3_600_000
    const kind: LayoffKind = noticeKind(n)
    const percent = n.layoffType?.match(/(\d{1,3}(?:\.\d+)?)% of staff/)?.[1]
    out.retried++
    const sent = await alertNewLayoff({
      noticeId: n.id, employer: n.employer, normalizedEmployer: n.normalizedEmployer, employees: n.employees,
      percent: percent ? parseFloat(percent) : null, kind, confirmed: kind !== 'news' || !/unconfirmed/i.test(n.layoffType ?? ''),
      sourceUrl: n.sourceUrl,
    }, { sendThin })
    if (sent) { out.sent++; if (sendThin) out.sentThin++ }
  }
  return out
}
