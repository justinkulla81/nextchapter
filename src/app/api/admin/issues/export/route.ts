import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { rowsToCsv, csvContentHeaders } from '@/lib/admin/csv-export'
import { loadIssueAnalytics, parseIssueFilters, flattenSegmentMatrixForCsv } from '@/lib/admin/issue-analytics'
import { captureServerEvent } from '@/lib/posthog/server'

// CSV export for every view on /support/admin/issues — Phase 2 Master
// Script, Part B, Prompt 4: "Every view exports CSV." One route handler
// keyed by `?view=`, rather than 6 separate routes, since every view shares
// the exact same filter parsing / data-loading path as the page itself
// (loadIssueAnalytics) — recomputing it 6 times over 6 files would be the
// kind of duplicated-pattern src/CLAUDE.md's design principles warn against.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()

  const searchParams = request.nextUrl.searchParams
  const rawParams: Record<string, string | undefined> = {}
  searchParams.forEach((value, key) => {
    rawParams[key] = value
  })

  const filters = parseIssueFilters(rawParams)
  const view = searchParams.get('view') ?? 'prevalence'
  const data = await loadIssueAnalytics(filters)

  let rows: Record<string, unknown>[]
  let filename: string

  switch (view) {
    case 'prevalence':
      rows = data.prevalence.map((r) => ({ ...r }))
      filename = 'issue-prevalence.csv'
      break
    case 'segment':
      rows = flattenSegmentMatrixForCsv(data.segmentMatrix)
      filename = 'issue-prevalence-by-segment.csv'
      break
    case 'fix-rates':
      rows = data.fixRates.map((r) => ({ ...r }))
      filename = 'issue-fix-rates.csv'
      break
    case 'point-impact':
      rows = data.pointImpact.map((r) => ({ ...r }))
      filename = 'issue-point-impact.csv'
      break
    case 'ats-matrix':
      rows = data.atsMatrix.map((r) => ({ ...r, topFailureReasons: r.topFailureReasons.join('; ') }))
      filename = 'ats-failure-matrix.csv'
      break
    case 'co-occurrence':
      rows = data.coOccurrence.map((r) => ({ ...r }))
      filename = 'issue-co-occurrence.csv'
      break
    default:
      return NextResponse.json({ error: `Unknown view "${view}"` }, { status: 400 })
  }

  captureServerEvent(admin.email ?? 'admin', 'admin_issue_analytics_exported', { view, filters: rawParams })

  return new NextResponse(rowsToCsv(rows), { headers: csvContentHeaders(filename) })
}
