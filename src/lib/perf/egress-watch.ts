import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { emailDocument, escapeHtml } from '@/lib/help/email-layout'

// Hourly data budget check (owner decisions 2026-11-14, after the Supabase egress quota cut the site off). The plan includes ~250 GB a
// month, about 8 GB a day, and the owner is emailed as soon as the rate goes over that (at most once a day). Postgres does not count bytes sent, so this estimates them from pg_stat_statements: rows returned over the last
// day (or six hours, for a spike or before a day of snapshots exists), times a row width (a statement that reads the full posting text is ~5 KB a row; others are measured from the average width of the
// columns they name, in pg_stats). It is an
// estimate; the real figure is on the Usage page. When the rate, as GB a day, passes the alert line the admin gets an email naming the
// statements behind it.

const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const SUPPORT = 'support@launchyournextchapter.com'
const SNAPSHOT_EVENT = 'db_egress_watch_snapshot'
const ALERT_EVENT = 'db_egress_alert_sent'
/** The short window: the newest snapshot at least this old, so one busy hour is not read as a whole day. */
const WINDOW_MS = 6 * 3600_000
/**
 * The day window. The nightly crons (market-size, job occupations, the search index) each read the job table once, between about 22:00
 * and 04:00 UTC; six hours that hold them, times four, counted each once-a-night pass four times (the 2026-11-23 04:40 alert said 8.5 GB
 * a day, ~2.7 of it nightly passes counted four times). The rate is judged over the last day once a day of snapshots exists.
 */
const DAY_WINDOW_MS = 24 * 3600_000
/** Over the short window alone, alert only at this multiple of the line: a real spike, not the nightly batch. */
const SPIKE_MULTIPLE = 2
/** Snapshots older than this are deleted (one a run, ~20 KB each). */
const SNAPSHOT_KEEP_MS = 2 * 24 * 3600_000
const USAGE_PAGE = 'https://supabase.com/dashboard/org/cpdalvjctomuevzcijtn/usage#egress'
const KEEP = 300
/** Alert line in GB a day: the plan's ~8 GB a day (owner, 2026-11-14). */
export const EGRESS_ALERT_GB = Number(process.env.EGRESS_ALERT_GB) || 8

const FULL_TEXT_ROW_BYTES = 5_000
const NARROW_ROW_BYTES = 250
/** A clipped posting text (left(description, n), n up to ~1,000) plus the narrow columns beside it. */
const CLIPPED_TEXT_ROW_BYTES = 1_200
/** A statement that returns only ids (a cuid and the row framing). */
const ID_ROW_BYTES = 40

/** Average stored width in bytes of each column, by table (pg_stats, the planner's own statistics). */
export type ColumnWidths = Map<string, Map<string, number>>

const FULL_TEXT_COLUMNS = ['description', 'descriptionHtml', 'rawText']
/** A text column whose stored average is under this is short text, not a posting (stored widths are compressed). */
const SHORT_TEXT_MAX_WIDTH = 400

/** Per-value framing on the wire (length word) and per-row framing, roughly. */
const COLUMN_OVERHEAD_BYTES = 4
const ROW_OVERHEAD_BYTES = 8

/** The table a plain `SELECT <columns> FROM <table>` reads, and its column list; null for anything else (a CTE, a subquery in the list). */
function plainSelect(query: string): { table: string; list: string } | null {
  if (!/^\s*SELECT\s/i.test(query)) return null
  const from = /\sFROM\s+(?:"?public"?\.)?"?(\w+)"?/i.exec(query)
  if (!from) return null
  const list = query.slice(query.search(/SELECT\s/i) + 7, from.index)
  if (/\(\s*SELECT\s/i.test(list)) return null
  return { table: from[1], list }
}

/**
 * Bytes a row of this statement sends, roughly. With `widths`, a plain SELECT is measured: the average width of each column it names
 * (pg_stats) plus framing. A flat 250 B a row put narrow reads (an id and an email, ~60 B) at four times their size and the
 * 2026-11-20 alert at 8.6 GB a day. Posting text keeps a fixed size: pg_stats holds its compressed size, and it is sent uncompressed
 * (~4.1 KB on average, sampled 2026-11-21). Without widths, or for a statement it can't read: full text ~5 KB, anything else 250 B.
 */
export function rowBytes(query: string, widths?: ColumnWidths): number {
  // A statement that clips the text (left(description, n)) sends at most the clip, even when a subquery names the full column: the
  // windowed company-signals read was counted as full text and put a 6-hour estimate at 22 GB a day (2026-11-16).
  if (/left\(\s*"?description"?\s*,/i.test(query)) return CLIPPED_TEXT_ROW_BYTES
  const plain = widths ? plainSelect(query) : null
  const cols = plain ? widths!.get(plain.table) : undefined
  const longText = /"description"|"descriptionHtml"|"rawText"/i.test(query)
  // A short column that happens to be called description (a mailing list's one line) is measured like any other: counting it as a
  // posting put a list read at 3 GB a day in the 2026-11-21 alert.
  if (longText && !(cols && [...FULL_TEXT_COLUMNS].every((c) => (cols.get(c) ?? 0) < SHORT_TEXT_MAX_WIDTH))) return FULL_TEXT_ROW_BYTES
  if (plain && cols) {
    const named = new Set<string>()
    for (const m of plain.list.matchAll(/"(\w+)"|\b([A-Za-z_]\w*)\b/g)) {
      const name = m[1] ?? m[2]
      if (cols.has(name)) named.add(name)
    }
    if (named.size > 0) return ROW_OVERHEAD_BYTES + [...named].reduce((sum, c) => sum + cols.get(c)! + COLUMN_OVERHEAD_BYTES, 0)
  }
  // Only ids come back (the AI-skill id set, the board's count read): counting them at 250 B put a ~0.06 GB a day read at 0.6 (2026-11-17).
  if (/^\s*SELECT\s+(?:DISTINCT\s+)?(?:"?\w+"?\.)?"?id"?\s+FROM\s/i.test(query)) return ID_ROW_BYTES
  return NARROW_ROW_BYTES
}

/** Column widths for the tables these statements read (one catalog read, a few hundred rows). Empty when pg_stats is unreadable. */
async function columnWidths(queries: string[]): Promise<ColumnWidths> {
  const tables = [...new Set(queries.map((q) => plainSelect(q)?.table).filter((t): t is string => !!t))]
  const out: ColumnWidths = new Map()
  if (tables.length === 0) return out
  try {
    const rows = await prisma.$queryRaw<{ tablename: string; attname: string; avg_width: number }[]>`
      SELECT tablename::text, attname::text, avg_width FROM pg_stats WHERE schemaname = 'public' AND tablename = ANY(${tables})`
    for (const r of rows) {
      if (!out.has(r.tablename)) out.set(r.tablename, new Map())
      out.get(r.tablename)!.set(r.attname, Number(r.avg_width))
    }
  } catch (error) {
    console.warn('Egress watch: column widths unreadable, using fixed row sizes', error instanceof Error ? error.message : error)
  }
  return out
}

export type WatchRow = { queryid: string; rows: number; calls: number; query: string }
export type WatchDelta = WatchRow & { deltaRows: number; deltaCalls: number; gb: number }

/** Each kept statement's rows since the snapshot (all of them when the counters were reset or it is new there), with its estimated GB. */
export function dailyDelta(now: WatchRow[], before: Record<string, { rows: number; calls: number }> | null, widths?: ColumnWidths): WatchDelta[] {
  return now
    .map((r) => {
      const b = before?.[r.queryid]
      const reset = !b || r.rows < b.rows
      const deltaRows = reset ? r.rows : r.rows - b.rows
      const deltaCalls = reset ? r.calls : Math.max(0, r.calls - b.calls)
      return { ...r, deltaRows, deltaCalls, gb: (deltaRows * rowBytes(r.query, widths)) / 1e9 }
    })
    .filter((d) => d.deltaRows > 0)
    .sort((a, b) => b.gb - a.gb)
}

/**
 * Whether the data use is over the line. Over the last day when a day of snapshots exists; over six hours only when that rate is a real
 * spike (SPIKE_MULTIPLE times the line), so the nightly batch is not read as a whole day of it. Before a day of snapshots, six hours decide.
 */
export function egressVerdict(i: { dayGb: number | null; shortGb: number; line: number }): { alert: boolean; window: 'day' | 'short' | null } {
  if (i.dayGb === null) return i.shortGb >= i.line ? { alert: true, window: 'short' } : { alert: false, window: null }
  if (i.dayGb >= i.line) return { alert: true, window: 'day' }
  if (i.shortGb >= i.line * SPIKE_MULTIPLE) return { alert: true, window: 'short' }
  return { alert: false, window: null }
}

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d })

export async function runEgressWatch(): Promise<{ estimatedGb: number; alerted: boolean; firstRun: boolean } | { skipped: string }> {
  let rows: WatchRow[]
  try {
    const raw = await prisma.$queryRawUnsafe<{ queryid: string; rows: number; calls: number; query: string }[]>(
      `SELECT queryid::text AS queryid, rows::float8 AS rows, calls::float8 AS calls, left(regexp_replace(query, '\\s+', ' ', 'g'), 1500) AS query
       FROM pg_stat_statements
       WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       ORDER BY rows DESC LIMIT ${KEEP}`
    )
    rows = raw.map((r) => ({ queryid: r.queryid, rows: Number(r.rows), calls: Number(r.calls), query: r.query }))
  } catch (error) {
    console.warn('Egress watch skipped:', error instanceof Error ? error.message : error)
    return { skipped: 'pg_stat_statements is not readable' }
  }

  const now = Date.now()
  type Snap = { properties: unknown; createdAt: Date }
  const snapAtLeast = (ms: number) =>
    prisma.analyticsEvent.findFirst({ where: { event: SNAPSHOT_EVENT, createdAt: { lte: new Date(now - ms) } }, orderBy: { createdAt: 'desc' }, select: { properties: true, createdAt: true } })
  const daySnap: Snap | null = await snapAtLeast(DAY_WINDOW_MS)
  // The newest snapshot at least WINDOW_MS old; in the first hours, the oldest there is (at least an hour old).
  const shortSnap: Snap | null =
    (await snapAtLeast(WINDOW_MS)) ??
    (await prisma.analyticsEvent.findFirst({ where: { event: SNAPSHOT_EVENT, createdAt: { lte: new Date(now - 3600_000) } }, orderBy: { createdAt: 'asc' }, select: { properties: true, createdAt: true } }))
  const totalsOf = (snap: Snap | null) => ((snap?.properties ?? null) as { totals?: Record<string, { rows: number; calls: number }> } | null)?.totals ?? null
  const totals = Object.fromEntries(rows.map((r) => [r.queryid, { rows: r.rows, calls: r.calls }]))
  await prisma.analyticsEvent.create({ data: { distinctId: 'system', event: SNAPSHOT_EVENT, properties: { totals } } })
  await prisma.analyticsEvent.deleteMany({ where: { event: SNAPSHOT_EVENT, createdAt: { lt: new Date(now - SNAPSHOT_KEEP_MS) } } }).catch(() => undefined)

  if (!shortSnap || totalsOf(shortSnap) === null) return { estimatedGb: 0, alerted: false, firstRun: true }
  const widths = await columnWidths(rows.map((r) => r.query))
  const measure = (snap: Snap) => {
    const hours = Math.max(1, (now - snap.createdAt.getTime()) / 3_600_000)
    const deltas = dailyDelta(rows, totalsOf(snap), widths)
    return { hours, deltas, gbPerDay: (deltas.reduce((s, d) => s + d.gb, 0) * 24) / hours }
  }
  const short = measure(shortSnap)
  const day = daySnap && totalsOf(daySnap) ? measure(daySnap) : null
  const judged = egressVerdict({ dayGb: day?.gbPerDay ?? null, shortGb: short.gbPerDay, line: EGRESS_ALERT_GB })
  // The email names the window that crossed: the day when it did (or there is no day yet), else the spike.
  const shown = judged.window === 'short' || !day ? short : day
  const { hours, deltas } = shown
  const perDay = (gb: number) => (gb * 24) / hours
  // The figure reported: the day's rate, or the six-hour rate when that is what crossed (a spike) or all there is.
  const estimatedGb = shown.gbPerDay
  const rounded = Math.round(estimatedGb * 10) / 10
  if (!judged.alert || !process.env.RESEND_API_KEY) return { estimatedGb: rounded, alerted: false, firstRun: false }
  // At most one email a day: the next one only if it is still over a day later.
  const recent = await prisma.analyticsEvent.findFirst({ where: { event: ALERT_EVENT, createdAt: { gte: new Date(now - 24 * 3600_000) } }, select: { id: true } })
  if (recent) return { estimatedGb: rounded, alerted: false, firstRun: false }

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
    footer: `Daily estimate from pg_stat_statements (rows returned times the average width of the columns read). The real egress figure is on the Usage page: ${USAGE_PAGE}.`,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;line-height:1.3">${escapeHtml(headline)}</p>
      <p style="margin:0 0 14px;font-size:14px;color:#55606e">Measured over the last ${fmt(hours, 0)} hours. The plan includes about 8 GB a day (250 GB a month). Over that, Supabase bills extra or, with the spend cap on, cuts the site's database off. These statements sent the most:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px">${tableRows}</table>`,
  })
  const text =
    `${headline} (alert line ${EGRESS_ALERT_GB} GB, plan about 8 GB a day).\n\n` +
    top.map((d, i) => `${i + 1}. ~${fmt(perDay(d.gb), 1)} GB/day, ${fmt(d.deltaRows)} rows, ${fmt(d.deltaCalls)} runs\n   ${d.query.slice(0, 220)}`).join('\n') +
    `\n\nReal egress figure: ${USAGE_PAGE}`
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({ from: `NextChapter Support <${SUPPORT}>`, to: ADMIN_TO, subject: `Data use alert: about ${fmt(estimatedGb, 1)} GB a day`, html, text })
  if (error) console.error('Egress watch email failed:', error)
  else await prisma.analyticsEvent.create({ data: { distinctId: 'system', event: ALERT_EVENT, properties: { estimatedGb: rounded } } })
  return { estimatedGb: rounded, alerted: !error, firstRun: false }
}
