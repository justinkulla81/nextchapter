import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'
import { stateName } from '@/lib/seo/states'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { notifyMember } from '@/lib/notifications/member-notifications'
import { jobAlertDailyCap, layoffAlertEmailsOn } from '@/lib/leads/job-alert-config'
import { sentToday } from '@/lib/leads/job-alerts'
import LayoffAlertDigestEmail from '@/emails/layoff-alert-digest'

// Layoff watch: someone on a /layoffs page asks to hear about new notices for one employer or one state.
// A HomepageLead of kind layoff_alert: searchQ = the employer slug (or ''), searchLoc = the state code (or '').
// Double opt-in like the job alerts. Facts only, from the public WARN record; no AI.

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const DAY_MS = 86_400_000
const MAX_NOTICES = 5
const FROM = 'NextChapter <support@launchyournextchapter.com>'

/** "Acme Corp" from "acme-corp": the slug is all we store, so the name is rebuilt from it. */
export const prettySlug = (slug: string) => slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/** What the person is watching, for emails and pages. */
export function layoffWatchLabel(l: { searchQ: string; searchLoc: string }): string {
  if (l.searchQ) return `${prettySlug(l.searchQ)}${l.searchLoc ? ` in ${stateName(l.searchLoc)}` : ''}`
  return l.searchLoc ? stateName(l.searchLoc) : 'new layoff notices'
}

const matches = (n: PublicNotice, l: { searchQ: string; searchLoc: string }) =>
  (!l.searchQ || n.slug === l.searchQ) && (!l.searchLoc || n.state === l.searchLoc) && !!(l.searchQ || l.searchLoc)

export interface LayoffAlertRunSummary {
  enabled: boolean
  confirmedWatches: number
  people: number
  peopleWithNewNotices: number
  sent: number
  failed: number
  cappedOut: number
  memberNotifications: number
}

const DEADLINE_MS = 240_000

/**
 * Daily run, two parts:
 *  1. In-app: members whose current employer filed a notice in the last 3 days get a bell notification (no email; deduped).
 *  2. Email: confirmed layoff watches get one email a day with up to five new notices. Off until LAYOFF_ALERT_EMAILS=1;
 *     off, it only reports counts.
 */
export async function runLayoffAlerts(): Promise<LayoffAlertRunSummary> {
  const started = Date.now()
  const enabled = layoffAlertEmailsOn()
  const notices = await getPublicNotices()
  const summary: LayoffAlertRunSummary = { enabled, confirmedWatches: 0, people: 0, peopleWithNewNotices: 0, sent: 0, failed: 0, cappedOut: 0, memberNotifications: 0 }

  // 1. The bell: a member's current employer.
  const recent = notices.filter((n) => Date.now() - n.fetchedAt.getTime() < 3 * DAY_MS)
  if (recent.length) {
    const byNorm = new Map<string, PublicNotice[]>()
    for (const n of recent) {
      const key = normalizeOrgName(n.employer)
      if (key) byNorm.set(key, [...(byNorm.get(key) ?? []), n])
    }
    const current = await prisma.workHistoryEntry.findMany({
      where: { isCurrent: true, companyNameNormalized: { in: [...byNorm.keys()] }, candidate: { isSampleData: false, deactivatedAt: null } },
      select: { candidateId: true, companyNameNormalized: true },
    })
    for (const w of current) {
      for (const n of byNorm.get(w.companyNameNormalized) ?? []) {
        const wrote = await notifyMember(w.candidateId, {
          kind: 'layoff_employer',
          title: `A layoff notice was filed for ${n.employer}`,
          body: `${n.workers != null ? `${n.workers.toLocaleString()} workers named` : 'Worker count not published'} in ${stateName(n.state)}. Public record.`,
          href: `/layoffs/company/${n.slug}`,
          dedupeKey: `layoff:${n.id}`,
        }).catch(() => false)
        if (wrote) summary.memberNotifications++
      }
    }
  }

  // 2. The emails.
  const leads = await prisma.homepageLead.findMany({
    where: { kind: 'layoff_alert', confirmedAt: { not: null }, unsubscribedAt: null },
    orderBy: { confirmedAt: 'asc' },
    take: 2000,
    select: { id: true, email: true, unsubscribeToken: true, searchQ: true, searchLoc: true, confirmedAt: true, lastAlertAt: true, journeySlug: true },
  })
  summary.confirmedWatches = leads.length
  const byEmail = new Map<string, typeof leads>()
  for (const l of leads) byEmail.set(l.email, [...(byEmail.get(l.email) ?? []), l])
  summary.people = byEmail.size
  let budget = enabled ? Math.max(0, jobAlertDailyCap() - (await sentToday())) : Infinity

  for (const [email, group] of byEmail) {
    if (Date.now() - started > DEADLINE_MS) break
    if (group.some((l) => l.lastAlertAt && Date.now() - l.lastAlertAt.getTime() < DAY_MS - 3_600_000)) continue
    const seen = new Set<string>()
    const found: PublicNotice[] = []
    for (const l of group) {
      const since = l.lastAlertAt ?? l.confirmedAt!
      for (const n of notices) {
        if (n.fetchedAt > since && matches(n, l) && !seen.has(n.id)) {
          seen.add(n.id)
          found.push(n)
        }
      }
    }
    if (found.length === 0) continue
    summary.peopleWithNewNotices++
    if (!enabled) continue
    if (budget <= 0) {
      summary.cappedOut++
      continue
    }
    if (!process.env.RESEND_API_KEY || isUndeliverableAddress(email)) continue
    found.sort((a, b) => b.noticeDate.getTime() - a.noticeDate.getTime())
    const picked = found.slice(0, MAX_NOTICES)
    const primary = group[0]
    const watching = group.length === 1 ? layoffWatchLabel(primary) : 'what you are watching'
    try {
      const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({
        from: FROM,
        replyTo: 'support@launchyournextchapter.com',
        to: email,
        subject: `${picked.length} new layoff ${picked.length === 1 ? 'notice' : 'notices'}: ${watching}`,
        react: LayoffAlertDigestEmail({
          watching,
          notices: picked.map((n) => ({
            employer: n.employer,
            state: n.state,
            place: n.place,
            workers: n.workers,
            filedOn: n.noticeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
            href: `${APP_URL()}/api/job-alerts/click/${primary.unsubscribeToken}?to=${encodeURIComponent(`/layoffs/company/${n.slug}`)}`,
          })),
          startUrl: `${APP_URL()}/api/job-alerts/journey/${primary.unsubscribeToken}?p=laid-off&via=email`,
          unsubscribeUrl: `${APP_URL()}/api/unsubscribe/lead/${primary.unsubscribeToken}`,
        }),
        headers: { 'List-Unsubscribe': `<${APP_URL()}/api/unsubscribe/lead/${primary.unsubscribeToken}>` },
      })
      if (error) {
        console.error('layoff alert failed:', error)
        summary.failed++
        continue
      }
      await prisma.homepageLead.updateMany({ where: { id: { in: group.map((l) => l.id) } }, data: { lastAlertAt: new Date() } })
      captureServerEvent(email, 'alert_sent', { kind: 'layoff_alert', notices: picked.length })
      summary.sent++
      budget--
    } catch (e) {
      console.error('layoff alert failed:', e)
      summary.failed++
    }
  }
  return summary
}
