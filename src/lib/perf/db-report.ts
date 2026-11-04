import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { emailDocument, escapeHtml } from '@/lib/help/email-layout'

const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const SUPPORT = 'support@launchyournextchapter.com'
const SNAPSHOT_EVENT = 'db_statements_snapshot'
const KEEP = 200

export type StatementRow = { queryid: string; calls: number; totalMs: number; maxMs: number; query: string }
export type StatementTotals = Record<string, { calls: number; totalMs: number }>
export type StatementDelta = StatementRow & { deltaCalls: number; deltaMs: number }

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
      return { ...r, deltaCalls: reset ? r.calls : r.calls - prev.calls, deltaMs: reset ? r.totalMs : r.totalMs - prev.totalMs }
    })
    .filter((r) => r.deltaCalls > 0)
    .sort((a, b) => b.deltaMs - a.deltaMs)
}

const seconds = (ms: number) => (ms / 1000).toLocaleString('en-US', { maximumFractionDigits: ms >= 10_000 ? 0 : 1 })

/** Monday: the ten statements that took the most database time this week, with the longest single run of each. Emailed to the admin. */
export async function runDbSlowQueryReport(): Promise<{ reported: number; firstRun: boolean } | { skipped: string }> {
  let rows: StatementRow[]
  try {
    const raw = await prisma.$queryRaw<{ queryid: string; calls: number; total_ms: number; max_ms: number; query: string }[]>`
      SELECT queryid::text AS queryid, calls::float8 AS calls, total_exec_time AS total_ms, max_exec_time AS max_ms,
             left(regexp_replace(query, '\s+', ' ', 'g'), 260) AS query
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY total_exec_time DESC LIMIT ${KEEP}`
    rows = raw.map((r) => ({ queryid: r.queryid, calls: Number(r.calls), totalMs: Number(r.total_ms), maxMs: Number(r.max_ms), query: r.query }))
  } catch (error) {
    // The extension is missing, or this role may not read it: nothing to report, and nothing to break.
    console.warn('Weekly database report skipped:', error instanceof Error ? error.message : error)
    return { skipped: 'pg_stat_statements is not readable' }
  }

  const last = await prisma.analyticsEvent.findFirst({ where: { event: SNAPSHOT_EVENT }, orderBy: { createdAt: 'desc' }, select: { properties: true } })
  const before = ((last?.properties as { totals?: StatementTotals } | null)?.totals ?? null) as StatementTotals | null
  const top = weeklyDelta(rows, before).slice(0, 10)

  const totals: StatementTotals = Object.fromEntries(rows.map((r) => [r.queryid, { calls: r.calls, totalMs: r.totalMs }]))
  await prisma.analyticsEvent.create({ data: { distinctId: 'system', event: SNAPSHOT_EVENT, properties: { totals } } })

  if (!process.env.RESEND_API_KEY || top.length === 0) return { reported: 0, firstRun: before === null }

  const tableRows = top.map((r, i) => `
    <tr>
      <td style="padding:6px 8px 6px 0;vertical-align:top;color:#55606e">${i + 1}</td>
      <td style="padding:6px 12px 6px 0;vertical-align:top;font-size:12px;line-height:1.45;font-family:ui-monospace,Menlo,monospace;word-break:break-all">${escapeHtml(r.query)}</td>
      <td style="padding:6px 0;vertical-align:top;white-space:nowrap;font-size:13px;text-align:right">${r.deltaCalls.toLocaleString('en-US')} runs<br>${seconds(r.deltaMs)} s total<br>longest ${seconds(r.maxMs)} s</td>
    </tr>`).join('')
  const html = emailDocument({
    preheader: `The ten statements that took the most database time ${before ? 'this week' : 'so far'}.`,
    label: 'Database',
    footer: 'Weekly, from pg_stat_statements. A statement near 120 s is one that hit the database time limit.',
    bodyHtml: `
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;line-height:1.3">Slowest database work ${before ? 'this week' : 'so far'}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#55606e">The ten statements that took the most total database time. A short list that keeps coming back is the one to fix.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px">${tableRows}</table>`,
  })
  const text = `Slowest database work ${before ? 'this week' : 'so far'}\n\n${top.map((r, i) => `${i + 1}. ${r.deltaCalls} runs, ${seconds(r.deltaMs)} s total, longest ${seconds(r.maxMs)} s\n   ${r.query}`).join('\n\n')}`
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({ from: `NextChapter Support <${SUPPORT}>`, to: ADMIN_TO, subject: 'Weekly database report: the ten slowest statements', html, text })
  if (error) console.error('Weekly database report email failed:', error)
  return { reported: error ? 0 : top.length, firstRun: before === null }
}
