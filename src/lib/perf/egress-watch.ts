import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { emailDocument, escapeHtml } from '@/lib/help/email-layout'

// Daily data budget check (owner decision 2026-11-14, after the Supabase egress quota cut the site off). The plan includes ~250 GB a
// month, about 8 GB a day. Postgres does not count bytes sent, so this estimates them from pg_stat_statements: rows returned since
// yesterday's snapshot, times a row width (a statement that reads the full posting text is ~5 KB a row, others ~250 B). It is an
// estimate; the real figure is on the Usage page. When the day's estimate passes the alert line the admin gets an email naming the
// statements behind it.

const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const SUPPORT = 'support@launchyournextchapter.com'
const SNAPSHOT_EVENT = 'db_egress_watch_snapshot'
const USAGE_PAGE = 'https://supabase.com/dashboard/org/cpdalvjctomuevzcijtn/usage#egress'
const KEEP = 300
/** Alert line in GB a day. The plan allows ~8; alerting at 6 leaves room to act. */
export const EGRESS_ALERT_GB = Number(process.env.EGRESS_ALERT_GB) || 6

const FULL_TEXT_ROW_BYTES = 5_000
const NARROW_ROW_BYTES = 250

/** Bytes a row of this statement sends, roughly: full posting or course text is ~5 KB, anything else a few hundred bytes. */
export function rowBytes(query: string): number {
  const q = query.replace(/left\(\s*"?description"?[^)]*\)/gi, '')
  return /"description"|"descriptionHtml"|"rawText"/i.test(q) ? FULL_TEXT_ROW_BYTES : NARROW_ROW_BYTES
}

export type WatchRow = { queryid: string; rows: number; calls: number; query: string }
export type WatchDelta = WatchRow & { deltaRows: number; deltaCalls: number; gb: number }

/** Each kept statement's rows since the snapshot (all of them when the counters were reset or it is new there), with its estimated GB. */
export function dailyDelta(now: WatchRow[], before: Record<string, { rows: number; calls: number }> | null): WatchDelta[] {
  return now
    .map((r) => {
      const b = before?.[r.queryid]
      const reset = !b || r.rows < b.rows
      const deltaRows = reset ? r.rows : r.rows - b.rows
      const deltaCalls = reset ? r.calls : Math.max(0, r.calls - b.calls)
      return { ...r, deltaRows, deltaCalls, gb: (deltaRows * rowBytes(r.query)) / 1e9 }
    })
    .filter((d) => d.deltaRows > 0)
    .sort((a, b) => b.gb - a.gb)
}

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d })

export async function runEgressWatch(): Promise<{ estimatedGb: number; alerted: boolean; firstRun: boolean } | { skipped: string }> {
  let rows: WatchRow[]
  try {
    const raw = await prisma.$queryRawUnsafe<{ queryid: string; rows: number; calls: number; query: string }[]>(
      `SELECT queryid::text AS queryid, rows::float8 AS rows, calls::float8 AS calls, left(regexp_replace(query, '\\s+', ' ', 'g'), 400) AS query
       FROM pg_stat_statements
       WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       ORDER BY rows DESC LIMIT ${KEEP}`
    )
    rows = raw.map((r) => ({ queryid: r.queryid, rows: Number(r.rows), calls: Number(r.calls), query: r.query }))
  } catch (error) {
    console.warn('Egress watch skipped:', error instanceof Error ? error.message : error)
    return { skipped: 'pg_stat_statements is not readable' }
  }

  const last = await prisma.analyticsEvent.findFirst({ where: { event: SNAPSHOT_EVENT }, orderBy: { createdAt: 'desc' }, select: { properties: true, createdAt: true } })
  const prior = (last?.properties ?? null) as { totals?: Record<string, { rows: number; calls: number }> } | null
  const before = prior?.totals ?? null
  const totals = Object.fromEntries(rows.map((r) => [r.queryid, { rows: r.rows, calls: r.calls }]))
  await prisma.analyticsEvent.create({ data: { distinctId: 'system', event: SNAPSHOT_EVENT, properties: { totals } } })

  const firstRun = before === null || !last
  if (firstRun) return { estimatedGb: 0, alerted: false, firstRun: true }
  const hours = Math.max(1, (Date.now() - last.createdAt.getTime()) / 3_600_000)
  const deltas = dailyDelta(rows, before)
  const perDay = (gb: number) => (gb * 24) / hours
  const estimatedGb = perDay(deltas.reduce((s, d) => s + d.gb, 0))
  if (estimatedGb < EGRESS_ALERT_GB || !process.env.RESEND_API_KEY) return { estimatedGb: Math.round(estimatedGb * 10) / 10, alerted: false, firstRun: false }

  const top = deltas.slice(0, 8)
  const tableRows = top
    .map(
      (d, i) => `
    <tr>
      <td style="padding:6px 8px 6px 0;vertical-align:top;color:#55606e">${i + 1}</td>
      <td style="padding:6px 12px 6px 0;vertical-align:top;font-size:12px;line-height:1.45;font-family:ui-monospace,Menlo,monospace;word-break:break-all">${escapeHtml(d.query.slice(0, 220))}</td>
      <td style="padding:6px 0;vertical-align:top;white-space:nowrap;font-size:13px;text-align:right">~${fmt(perDay(d.gb), 1)} GB/day<br>${fmt(d.deltaRows)} rows<br>${fmt(d.deltaCalls)} runs</td>
    </tr>`
    )
    .join('')
  const headline = `Database data use is about ${fmt(estimatedGb, 1)} GB a day`
  const html = emailDocument({
    preheader: `${headline}; the alert line is ${EGRESS_ALERT_GB} GB and the plan allows about 8.`,
    label: 'Database',
    footer: `Daily estimate from pg_stat_statements (rows returned times a row width). The real egress figure is on the Usage page: ${USAGE_PAGE}.`,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;line-height:1.3">${escapeHtml(headline)}</p>
      <p style="margin:0 0 14px;font-size:14px;color:#55606e">The plan includes about 8 GB a day (250 GB a month). Over that, Supabase bills extra or, with the spend cap on, cuts the site's database off. These statements sent the most:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px">${tableRows}</table>`,
  })
  const text =
    `${headline} (alert line ${EGRESS_ALERT_GB} GB, plan about 8 GB a day).\n\n` +
    top.map((d, i) => `${i + 1}. ~${fmt(perDay(d.gb), 1)} GB/day, ${fmt(d.deltaRows)} rows, ${fmt(d.deltaCalls)} runs\n   ${d.query.slice(0, 220)}`).join('\n') +
    `\n\nReal egress figure: ${USAGE_PAGE}`
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({ from: `NextChapter Support <${SUPPORT}>`, to: ADMIN_TO, subject: `Data use alert: about ${fmt(estimatedGb, 1)} GB a day`, html, text })
  if (error) console.error('Egress watch email failed:', error)
  return { estimatedGb: Math.round(estimatedGb * 10) / 10, alerted: !error, firstRun: false }
}
