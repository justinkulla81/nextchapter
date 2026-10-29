import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { loadSearchPerformance } from '@/lib/google/search-performance'
import {
  PERF_WINDOWS,
  aggregatePages,
  aggregateQueries,
  groupStats,
  nearMisses,
  pageTwoQueries,
  toCsv,
  type PerfWindowDays,
  type QueryAgg,
} from '@/lib/seo/search-analysis'

// CSV of one table on the admin "Search queries" page, for the window in the address (?days=7|28|90&table=queries|near|page2|pages|groups).
// Uses the same cached read as the page, so a download never costs extra Google calls. Admin only.
export const maxDuration = 30

const queryCsv = (rows: QueryAgg[]) =>
  toCsv(
    ['search', 'landing_page', 'clicks', 'impressions', 'ctr_percent', 'avg_position', 'clicks_before', 'impressions_before'],
    rows.map((q) => [q.query, q.topPage, q.clicks, q.impressions, +(q.ctr * 100).toFixed(2), +q.position.toFixed(1), q.prevClicks, q.prevImpressions]),
  )

export async function GET(request: NextRequest) {
  await requireAdmin()
  const params = request.nextUrl.searchParams
  const n = Number(params.get('days'))
  const days = ((PERF_WINDOWS as number[]).includes(n) ? n : 28) as PerfWindowDays
  const table = params.get('table') ?? 'queries'
  if (!['queries', 'near', 'page2', 'pages', 'groups'].includes(table)) return NextResponse.json({ ok: false, message: 'Unknown table.' }, { status: 400 })

  const result = await loadSearchPerformance(days)
  if (result.status !== 'ok') return NextResponse.json({ ok: false, message: 'Search Console is not available. Open the Search queries page for what to fix.', status: result.status }, { status: 502 })

  const queries = aggregateQueries(result.rows, result.prevRows)
  let csv: string
  if (table === 'queries') csv = queryCsv(queries)
  else if (table === 'near') csv = queryCsv(nearMisses(queries))
  else if (table === 'page2') csv = queryCsv(pageTwoQueries(queries))
  else if (table === 'pages')
    csv = toCsv(
      ['page', 'clicks', 'impressions', 'ctr_percent', 'avg_position', 'clicks_before', 'impressions_before'],
      aggregatePages(result.rows, result.prevRows).map((p) => [p.page, p.clicks, p.impressions, +(p.ctr * 100).toFixed(2), +p.position.toFixed(1), p.prevClicks, p.prevImpressions]),
    )
  else
    csv = toCsv(
      ['group', 'searches', 'clicks', 'impressions', 'ctr_percent', 'avg_position', 'clicks_before', 'impressions_before'],
      groupStats(result.rows, result.prevRows).map((g) => [g.label, g.queries, g.clicks, g.impressions, +(g.ctr * 100).toFixed(2), +g.position.toFixed(1), g.prevClicks, g.prevImpressions]),
    )

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="search-${table}-${days}d-${result.current.endDate}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
