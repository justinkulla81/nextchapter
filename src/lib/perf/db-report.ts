import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { emailDocument, escapeHtml } from '@/lib/help/email-layout'

const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const SUPPORT = 'support@launchyournextchapter.com'
const SNAPSHOT_EVENT = 'db_statements_snapshot'
const KEEP = 200

// rows and blksRead are optional: snapshots taken before they were added carry neither, and the week after such a snapshot has no baseline for them.
export type StatementRow = { queryid: string; calls: number; totalMs: number; maxMs: number; query: string; rows?: number; blksRead?: number }
export type StatementTotals = Record<string, { calls: number; totalMs: number; rows?: number; blksRead?: number }>
export type StatementDelta = StatementRow & { deltaCalls: number; deltaMs: number; deltaRows: number | null; deltaBlksRead: number | null }

/** A table's size at a snapshot (pg_stat_user_tables.n_live_tup, an estimate that costs nothing to read). */
export type TableSizes = Record<string, number>
/** Blocks served from memory and blocks read in, for the whole database (pg_stat_database). */
export type IoCounters = { hit: number; read: number }

/** The tables whose size matters for the budgets: each is read whole somewhere, so growth multiplies that cost. */
export const WATCHED_TABLES = ['Company', 'ExclusiveJobPosting', 'WarnNotice', 'GeoPlace', 'BoardLightRow'] as const
export const GROWTH_FLAG_PCT = 20

/**
 * What each statement cost since the last snapshot. pg_stat_statements only ever counts up, so "the top ten" from it alone is the top
 * ten of all time; the difference from last week's snapshot is the top ten of this week. Without a snapshot (the first run), or if the
 * counters were reset since, the full count is the best figure available.
 */
export function weeklyDelta(now: StatementRow[], before: StatementTotals | null): StatementDelta[] {
  return now
    .map((r) => {
      const prev = before?.[r.queryid]
      const reset = !prev || r.calls < prev.calls
      // A counter the last snapshot did not have has no baseline: null, not the all-time figure, so a first week is never read as a spike.
      const since = (now: number | undefined, then: number | undefined) => (now === undefined ? null : reset ? now : then === undefined ? null : Math.max(0, now - then))
      return {
        ...r,
        deltaCalls: reset ? r.calls : r.calls - prev.calls,
        deltaMs: reset ? r.totalMs : r.totalMs - prev.totalMs,
        deltaRows: since(r.rows, prev?.rows),
        deltaBlksRead: since(r.blksRead, prev?.blksRead),
      }
    })
    .filter((r) => r.deltaCalls > 0)
    .sort((a, b) => b.deltaMs - a.deltaMs)
}

/** The n statements with the largest weekly figure for `key`; statements with no baseline for it (null) or no change are left out. */
export function topBy(deltas: StatementDelta[], key: 'deltaRows' | 'deltaBlksRead', n = 5): (StatementDelta & { value: number })[] {
  return deltas
    .flatMap((d) => (d[key] != null && d[key]! > 0 ? [{ ...d, value: d[key]! }] : []))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}

export type TableGrowth = { table: string; now: number; before: number; pct: number; flagged: boolean }

/** Each watched table's size against the last snapshot. Flagged when it grew by GROWTH_FLAG_PCT or more; tables with no earlier figure are left out. */
export function tableGrowth(now: TableSizes, before: TableSizes | null): TableGrowth[] {
  if (!before) return []
  return WATCHED_TABLES.flatMap((table) => {
    const n = now[table]
    const b = before[table]
    if (n === undefined || b === undefined || b <= 0) return []
    const pct = Math.round(((n - b) / b) * 100)
    return [{ table, now: n, before: b, pct, flagged: pct >= GROWTH_FLAG_PCT }]
  })
}

/** Share of block reads served from memory since the last snapshot (all-time if there is none, or the counters were reset). */
export function cacheHitPct(now: IoCounters, before: IoCounters | null): number | null {
  const reset = !before || now.hit < before.hit || now.read < before.read
  const hit = reset ? now.hit : now.hit - before.hit
  const read = reset ? now.read : now.read - before.read
  return hit + read > 0 ? Math.round((hit / (hit + read)) * 1000) / 10 : null
}

const seconds = (ms: number) => (ms / 1000).toLocaleString('en-US', { maximumFractionDigits: ms >= 10_000 ? 0 : 1 })

const gb = (blocks: number) => ((blocks * 8) / 1024 / 1024).toLocaleString('en-US', { maximumFractionDigits: 1 })
const count = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const USAGE_PAGE = 'https://supabase.com/dashboard/org/cpdalvjctomuevzcijtn/usage#egress'

type RawStatement = { queryid: string; calls: number; total_ms: number; max_ms: number; rows: number; blks_read: number; query: string }

/** The statements worth keeping a counter for: the top of each ranking, so one that is cheap in time but heavy in rows or disk reads is not lost. */
async function readStatements(): Promise<StatementRow[]> {
  const top = (order: 'total_exec_time' | 'rows' | 'shared_blks_read') =>
    prisma.$queryRawUnsafe<RawStatement[]>(
      `SELECT queryid::text AS queryid, calls::float8 AS calls, total_exec_time AS total_ms, max_exec_time AS max_ms,
              rows::float8 AS rows, shared_blks_read::float8 AS blks_read, left(regexp_replace(query, '\\s+', ' ', 'g'), 260) AS query
       FROM pg_stat_statements
       WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       ORDER BY ${order} DESC LIMIT ${KEEP}`
    )
  const [byTime, byRows, byBlocks] = await Promise.all([top('total_exec_time'), top('rows'), top('shared_blks_read')])
  const seen = new Map<string, RawStatement>()
  for (const r of [...byTime, ...byRows, ...byBlocks]) seen.set(r.queryid, r)
  return [...seen.values()].map((r) => ({ queryid: r.queryid, calls: Number(r.calls), totalMs: Number(r.total_ms), maxMs: Number(r.max_ms), query: r.query, rows: Number(r.rows), blksRead: Number(r.blks_read) }))
}

async function readTableSizes(): Promise<TableSizes | null> {
  try {
    const raw = await prisma.$queryRaw<{ relname: string; n: number }[]>`
      SELECT relname, n_live_tup::float8 AS n FROM pg_stat_user_tables WHERE relname = ANY(${[...WATCHED_TABLES]}::text[])`
    return Object.fromEntries(raw.map((r) => [r.relname, Number(r.n)]))
  } catch (error) {
    console.warn('Weekly database report: table sizes unreadable:', error instanceof Error ? error.message : error)
    return null
  }
}

async function readIo(): Promise<IoCounters | null> {
  try {
    const [r] = await prisma.$queryRaw<{ hit: number; read: number }[]>`
      SELECT blks_hit::float8 AS hit, blks_read::float8 AS read FROM pg_stat_database WHERE datname = current_database()`
    return r ? { hit: Number(r.hit), read: Number(r.read) } : null
  } catch (error) {
    console.warn('Weekly database report: block counters unreadable:', error instanceof Error ? error.message : error)
    return null
  }
}

const queryCell = (q: string) => `<td style="padding:6px 12px 6px 0;vertical-align:top;font-size:12px;line-height:1.45;font-family:ui-monospace,Menlo,monospace;word-break:break-all">${escapeHtml(q)}</td>`
const section = (title: string, blurb: string, rows: string) => `
  <p style="margin:22px 0 4px;font-size:16px;font-weight:700;line-height:1.3">${escapeHtml(title)}</p>
  <p style="margin:0 0 10px;font-size:13px;color:#55606e">${escapeHtml(blurb)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px">${rows}</table>`

/**
 * Monday: what loaded the database this week, in three rankings (most database time, most rows returned, most disk reads), the share of reads
 * served from memory, and the watched tables' growth. Rows returned stand in for egress and disk reads for Disk IO, the two Supabase limits the
 * project went over in November 2026. Emailed to the admin.
 */
export async function runDbSlowQueryReport(): Promise<{ reported: number; firstRun: boolean } | { skipped: string }> {
  let rows: StatementRow[]
  try {
    rows = await readStatements()
  } catch (error) {
    // The extension is missing, or this role may not read it: nothing to report, and nothing to break.
    console.warn('Weekly database report skipped:', error instanceof Error ? error.message : error)
    return { skipped: 'pg_stat_statements is not readable' }
  }
  const [tables, io] = await Promise.all([readTableSizes(), readIo()])

  const last = await prisma.analyticsEvent.findFirst({ where: { event: SNAPSHOT_EVENT }, orderBy: { createdAt: 'desc' }, select: { properties: true } })
  const prior = (last?.properties ?? null) as { totals?: StatementTotals; tables?: TableSizes; io?: IoCounters } | null
  const before = prior?.totals ?? null
  const deltas = weeklyDelta(rows, before)
  const slowest = deltas.slice(0, 10)
  const mostRows = topBy(deltas, 'deltaRows')
  const mostReads = topBy(deltas, 'deltaBlksRead')
  const growth = tables ? tableGrowth(tables, prior?.tables ?? null) : []
  const hitPct = io ? cacheHitPct(io, prior?.io ?? null) : null

  const totals: StatementTotals = Object.fromEntries(rows.map((r) => [r.queryid, { calls: r.calls, totalMs: r.totalMs, rows: r.rows, blksRead: r.blksRead }]))
  await prisma.analyticsEvent.create({ data: { distinctId: 'system', event: SNAPSHOT_EVENT, properties: { totals, ...(tables ? { tables } : {}), ...(io ? { io } : {}) } } })

  const firstRun = before === null
  if (!process.env.RESEND_API_KEY || slowest.length === 0) return { reported: 0, firstRun }
  const period = before ? 'this week' : 'so far'
  const noBaseline = before !== null && mostRows.length === 0 && mostReads.length === 0

  const timeRows = slowest.map((r, i) => `
    <tr>
      <td style="padding:6px 8px 6px 0;vertical-align:top;color:#55606e">${i + 1}</td>
      ${queryCell(r.query)}
      <td style="padding:6px 0;vertical-align:top;white-space:nowrap;font-size:13px;text-align:right">${count(r.deltaCalls)} runs<br>${seconds(r.deltaMs)} s total<br>longest ${seconds(r.maxMs)} s</td>
    </tr>`).join('')
  const rowRows = mostRows.map((r, i) => `
    <tr>
      <td style="padding:6px 8px 6px 0;vertical-align:top;color:#55606e">${i + 1}</td>
      ${queryCell(r.query)}
      <td style="padding:6px 0;vertical-align:top;white-space:nowrap;font-size:13px;text-align:right">${count(r.value)} rows<br>${count(r.deltaCalls)} runs<br>${count(r.value / Math.max(1, r.deltaCalls))} per run</td>
    </tr>`).join('')
  const readRows = mostReads.map((r, i) => `
    <tr>
      <td style="padding:6px 8px 6px 0;vertical-align:top;color:#55606e">${i + 1}</td>
      ${queryCell(r.query)}
      <td style="padding:6px 0;vertical-align:top;white-space:nowrap;font-size:13px;text-align:right">${gb(r.value)} GB read in<br>${count(r.deltaCalls)} runs</td>
    </tr>`).join('')
  const growthRows = growth.map((g) => `
    <tr>
      <td style="padding:4px 12px 4px 0;font-size:13px">${escapeHtml(g.table)}</td>
      <td style="padding:4px 12px 4px 0;font-size:13px;text-align:right">${count(g.now)} rows</td>
      <td style="padding:4px 0;font-size:13px;text-align:right${g.flagged ? ';font-weight:700;color:#b42318' : ''}">${g.pct >= 0 ? '+' : ''}${g.pct}%${g.flagged ? ' (check any read of this whole table)' : ''}</td>
    </tr>`).join('')

  const html = emailDocument({
    preheader: `Database load ${period}: slowest statements, most rows returned, most disk reads${hitPct !== null ? `, ${hitPct}% of reads from memory` : ''}.`,
    label: 'Database',
    footer: `Weekly, from pg_stat_statements. Rows returned stand in for Supabase egress, disk reads for Disk IO; the real egress total is on the Usage page: ${USAGE_PAGE}. A statement near 120 s is one that hit the database time limit.`,
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;line-height:1.3">Database load ${period}</p>
      <p style="margin:0 0 6px;font-size:14px;color:#55606e">A statement that keeps coming back in a list is the one to fix.${hitPct !== null ? ` ${hitPct}% of block reads were served from memory (healthy is above 99%).` : ''}</p>
      ${section('Most database time', 'The ten statements that took the most total time.', timeRows)}
      ${mostRows.length ? section('Most rows returned', 'Egress: rows leaving the database. A high "per run" figure is a whole-table read.', rowRows) : ''}
      ${mostReads.length ? section('Most disk reads', 'Disk IO: data read in from outside memory.', readRows) : ''}
      ${noBaseline ? '<p style="margin:18px 0 0;font-size:13px;color:#55606e">Rows and disk reads start counting from this week’s snapshot, so those lists begin next Monday.</p>' : ''}
      ${growth.length ? section('Table growth', `Size against last week; ${GROWTH_FLAG_PCT}% or more is flagged.`, growthRows) : ''}`,
  })
  const lines = (title: string, items: string[]) => (items.length ? `\n\n${title}\n${items.join('\n')}` : '')
  const text = `Database load ${period}${hitPct !== null ? ` (${hitPct}% of block reads from memory)` : ''}` +
    lines('Most database time', slowest.map((r, i) => `${i + 1}. ${count(r.deltaCalls)} runs, ${seconds(r.deltaMs)} s total, longest ${seconds(r.maxMs)} s\n   ${r.query}`)) +
    lines('Most rows returned', mostRows.map((r, i) => `${i + 1}. ${count(r.value)} rows over ${count(r.deltaCalls)} runs\n   ${r.query}`)) +
    lines('Most disk reads', mostReads.map((r, i) => `${i + 1}. ${gb(r.value)} GB read in over ${count(r.deltaCalls)} runs\n   ${r.query}`)) +
    lines('Table growth', growth.map((g) => `${g.table}: ${count(g.now)} rows, ${g.pct >= 0 ? '+' : ''}${g.pct}%${g.flagged ? ' (flagged)' : ''}`)) +
    `\n\nEgress total: ${USAGE_PAGE}`
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({ from: `NextChapter Support <${SUPPORT}>`, to: ADMIN_TO, subject: 'Weekly database report: time, rows and disk reads', html, text })
  if (error) console.error('Weekly database report email failed:', error)
  return { reported: error ? 0 : slowest.length, firstRun }
}
