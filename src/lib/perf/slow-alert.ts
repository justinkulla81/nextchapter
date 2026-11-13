import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { allowRequest } from '@/lib/security/rate-limit'
import { buttonHtml, emailDocument, escapeHtml, factsHtml } from '@/lib/help/email-layout'
import { ALERT_COOLDOWN_MS, ALERT_MIN_EVENTS, ALERT_MIN_PEOPLE, ALERT_MIN_TIMEOUTS, ALERT_WINDOW_MINUTES, SLOW_PAGE_MS } from '@/lib/perf/thresholds'

const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const SUPPORT = 'support@launchyournextchapter.com'

export type SlowRow = { event: string; who: string; route: string | null; label: string | null; path: string | null; timedOut: boolean; ms: number | null; /** When it was recorded (epoch ms), so one page load's reads can be told apart from separate loads. */ at?: number | null }

export type SlowVerdict = { alert: boolean; events: number; people: number; timeouts: number; pageLoads: number; reasons: string[] }

/** The reads of one page load fire together: one person's timeouts within this many seconds are one page load, not several. */
const SAME_PAGE_LOAD_S = 30

/**
 * Whether the last few minutes of slow-page reports are a problem worth an email: several slow or stalled loads from more than one person,
 * or several page loads (not several reads: a dashboard load makes eight at once) that had a read give up at its deadline.
 * One person's one slow page is not an alert; a database that stopped answering is. (2026-11-07: one member's single page load, with
 * eight badge reads timing out together, sent an alert saying pages were slow for members.)
 */
export function judgeSlowRows(rows: SlowRow[]): SlowVerdict {
  const people = new Set(rows.map((r) => r.who)).size
  const timedOut = rows.filter((r) => r.event === 'page_query_stalled' && r.timedOut)
  const timeouts = timedOut.length
  // A row with no time counts as its own page load.
  const loadsOf = (list: SlowRow[]) => new Set(list.map((r, i) => (r.at == null ? `row-${i}` : `${r.who}|${Math.floor(r.at / (SAME_PAGE_LOAD_S * 1000))}`))).size
  const pageLoads = loadsOf(timedOut)
  // The slow reports too are counted by page load, not by row: one dashboard load reports a slow read for each of its reads
  // (2026-11-12: 13 of 15 reports were one member's one page load, and the alert said "15 reports from 2 people").
  const slowLoads = loadsOf(rows)
  const reasons: string[] = []
  if (slowLoads >= ALERT_MIN_EVENTS && people >= ALERT_MIN_PEOPLE) reasons.push(`${slowLoads} slow or stalled page loads (${rows.length} reports) from ${people} people in ${ALERT_WINDOW_MINUTES} minutes`)
  if (pageLoads >= ALERT_MIN_TIMEOUTS) reasons.push(`${pageLoads} page loads had a read give up at its deadline (${timeouts} reads)`)
  return { alert: reasons.length > 0, events: rows.length, people, timeouts, pageLoads, reasons }
}

/** The biggest offenders, by what was slow (a read's label, or a page's path), most first. */
export function topOffenders(rows: SlowRow[], limit = 6): { what: string; count: number; worstMs: number | null }[] {
  const by = new Map<string, { count: number; worstMs: number | null }>()
  for (const r of rows) {
    const what = r.label ? `${r.route ?? 'page'} · ${r.label}` : `page ${r.path ?? 'unknown'}`
    const e = by.get(what) ?? { count: 0, worstMs: null }
    e.count++
    if (r.ms !== null && (e.worstMs === null || r.ms > e.worstMs)) e.worstMs = r.ms
    by.set(what, e)
  }
  return [...by].map(([what, e]) => ({ what, ...e })).sort((a, b) => b.count - a.count).slice(0, limit)
}

async function recentRows(): Promise<SlowRow[]> {
  const rows = await prisma.$queryRaw<{ event: string; who: string; route: string | null; label: string | null; path: string | null; timed_out: string | null; ms: string | null; waited: string | null; at: string | null }[]>`
    SELECT event, "distinctId" AS who, properties->>'route' AS route, properties->>'label' AS label, properties->>'path' AS path,
           properties->>'timedOut' AS timed_out, properties->>'ms' AS ms, properties->>'waitedMs' AS waited,
           (extract(epoch from "createdAt") * 1000)::bigint::text AS at
    FROM "AnalyticsEvent"
    WHERE event IN ('page_query_stalled', 'page_load_slow', 'page_load_stalled')
      AND "createdAt" > now() - make_interval(mins => ${ALERT_WINDOW_MINUTES}::int)`
  return rows.map((r) => ({
    event: r.event, who: r.who, route: r.route, label: r.label, path: r.path,
    timedOut: r.timed_out === 'true',
    ms: r.ms !== null ? Number(r.ms) : r.waited !== null ? Number(r.waited) : null,
    at: r.at !== null ? Number(r.at) : null,
  }))
}

/** Runs every few minutes. Emails the admin when pages are slow for several people at once, at most once an hour. */
export async function runSlowPageAlert(): Promise<{ checked: number; alerted: boolean; verdict: SlowVerdict }> {
  const rows = await recentRows()
  const verdict = judgeSlowRows(rows)
  if (!verdict.alert) return { checked: rows.length, alerted: false, verdict }
  if (!(await allowRequest({ bucket: 'slow-page-alert', key: 'global', limit: 1, windowMs: ALERT_COOLDOWN_MS }))) return { checked: rows.length, alerted: false, verdict }
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping the slow-page alert.')
    return { checked: rows.length, alerted: false, verdict }
  }

  const offenders = topOffenders(rows)
  const list = offenders.map((o) => `${o.what}: ${o.count} report${o.count === 1 ? '' : 's'}${o.worstMs !== null ? `, worst ${(o.worstMs / 1000).toFixed(1)} s` : ''}`)
  const html = emailDocument({
    preheader: verdict.reasons[0] ?? 'Pages are slow for several people.',
    label: 'Slow pages',
    footer: 'You get this when pages are slow for several people at once, at most once an hour.',
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.3">Pages are slow for members right now</p>
      ${factsHtml([['Why', verdict.reasons.join('; ')], ['Window', `last ${ALERT_WINDOW_MINUTES} minutes`], ['Slow means', `over ${SLOW_PAGE_MS / 1000} s to load`]])}
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#1d4e89">What is slow</p>
      <ul style="margin:0 0 18px;padding-left:18px;font-size:14px;line-height:1.6">${list.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#55606e">Look at what the cron jobs were doing in the Job health page, and at the database's active queries, before anything else.</p>
      ${buttonHtml('Open Job health', 'https://admin.launchyournextchapter.com/support/admin/job-health')}`,
  })
  const text = `Pages are slow for members right now\n\n${verdict.reasons.join('\n')}\n\nWhat is slow:\n${list.join('\n')}\n\nJob health: https://admin.launchyournextchapter.com/support/admin/job-health`
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({ from: `NextChapter Support <${SUPPORT}>`, to: ADMIN_TO, subject: 'Slow pages: members are waiting', html, text })
  if (error) {
    console.error('Slow-page alert email failed:', error)
    return { checked: rows.length, alerted: false, verdict }
  }
  return { checked: rows.length, alerted: true, verdict }
}
