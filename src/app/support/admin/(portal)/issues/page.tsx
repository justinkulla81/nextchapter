import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/admin/auth'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar, type AdminFilterOption } from '@/components/admin/AdminFilterBar'
import { CURRENT_JOB_STATUS_LABELS, GAP_DURATION_LABELS } from '@/lib/constants/onboarding'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { METRO_AREA_NAMES } from '@/lib/constants/metro-areas'
import {
  loadIssueAnalytics,
  parseIssueFilters,
  filtersToParams,
  RANGE_LABEL,
  SENIORITY_BAND_LABELS,
  FUNCTION_FAMILY_LABELS,
  PERSONA_LABELS,
  USAGE_TIER_LABELS,
  PIVOT_LABELS,
  type PrevalenceRow,
  type SegmentMatrixRow,
  type SegmentCell,
  type FixRateRow,
  type PointImpactRow,
  type AtsMatrixRow,
  type CoOccurrenceRow,
} from '@/lib/admin/issue-analytics'
import { ISSUE_CATEGORY_LABELS, ISSUE_SEVERITY_LABELS } from '@/lib/analytics/issue-labels'

const BASE_PATH = '/support/admin/issues'

function labelOptions<T extends string>(labels: Record<T, string>): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label: label as string }))
}

function exportHref(view: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({ ...params, view }).toString()
  return `/api/admin/issues/export?${qs}`
}

function ExportCsvButton({ view, params }: { view: string; params: Record<string, string> }) {
  return (
    <Button nativeButton={false} render={<a href={exportHref(view, params)} download />} variant="outline" size="sm">
      Export CSV
    </Button>
  )
}

function renderSegmentCell(cell: SegmentCell) {
  if (cell.suppressed) {
    return <span className="text-muted-foreground">insufficient data</span>
  }
  return (
    <span className={cell.deviates ? 'font-semibold text-warning' : ''}>
      {cell.rate}%{cell.deviates && <span className="ml-1 text-xs" title={`${cell.zScore}σ from overall`}>⚠</span>}
    </span>
  )
}

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const rawParams = await searchParams
  const filters = parseIssueFilters(rawParams)
  const params = filtersToParams(filters)

  const data = await loadIssueAnalytics(filters)

  const filterOptions: AdminFilterOption[] = [
    { key: 'range', label: 'Date range', value: filters.range, options: labelOptions(RANGE_LABEL) },
    { key: 'seniority', label: 'Seniority band', value: filters.seniority, options: labelOptions(SENIORITY_BAND_LABELS) },
    { key: 'function', label: 'Function family', value: filters.functionFamily, options: labelOptions(FUNCTION_FAMILY_LABELS) },
    { key: 'industry', label: 'Industry', value: filters.industry, options: INDUSTRY_BUCKET_NAMES.map((v) => ({ value: v, label: v })) },
    { key: 'metro', label: 'Metro', value: filters.metro, options: METRO_AREA_NAMES.map((v) => ({ value: v, label: v })) },
    { key: 'persona', label: 'Persona', value: filters.persona, options: labelOptions(PERSONA_LABELS) },
    { key: 'employment', label: 'Employment status', value: filters.employment, options: labelOptions(CURRENT_JOB_STATUS_LABELS) },
    { key: 'duration', label: 'Unemployment duration', value: filters.duration, options: labelOptions(GAP_DURATION_LABELS) },
    { key: 'usageTier', label: 'Usage tier', value: filters.usageTier, options: labelOptions(USAGE_TIER_LABELS) },
    { key: 'category', label: 'Issue category', value: filters.category, options: labelOptions(ISSUE_CATEGORY_LABELS) },
    { key: 'severity', label: 'Severity', value: filters.severity, options: labelOptions(ISSUE_SEVERITY_LABELS) },
    { key: 'pivot', label: 'Segment by', value: filters.pivot, options: labelOptions(PIVOT_LABELS) },
  ]

  // ── View 1: Prevalence ──
  const prevalenceColumns: AdminColumn<PrevalenceRow>[] = [
    {
      header: 'Issue',
      render: (r) => (
        <span>
          {r.label} <span className="text-xs text-muted-foreground">({r.issueCode})</span>
        </span>
      ),
    },
    { header: 'Category', render: (r) => ISSUE_CATEGORY_LABELS[r.category] ?? r.category },
    { header: 'Severity', render: (r) => ISSUE_SEVERITY_LABELS[r.severity] ?? r.severity },
    { header: 'Analyses w/ issue', className: 'px-3 py-2 tabular-nums', render: (r) => `${r.analysesWithIssue} / ${r.totalAnalyses}` },
    { header: 'Prevalence', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => `${r.prevalencePercent}%` },
  ]

  // ── View 2: Prevalence by segment ──
  const segmentColumns: AdminColumn<SegmentMatrixRow>[] = [
    { header: 'Issue', render: (r) => <span>{r.label} <span className="text-xs text-muted-foreground">({r.issueCode})</span></span> },
    { header: 'Overall', className: 'px-3 py-2 tabular-nums', render: (r) => `${r.overallRate}%` },
    ...data.segmentMatrix.segments.map((seg, i): AdminColumn<SegmentMatrixRow> => ({
      header: seg.suppressed ? `${seg.label} (n<5)` : `${seg.label} (n=${seg.memberCount})`,
      className: 'px-3 py-2 tabular-nums',
      render: (r) => renderSegmentCell(r.cells[i]),
    })),
  ]

  // ── View 3: Fix rates ──
  const fixRateColumns: AdminColumn<FixRateRow>[] = [
    { header: 'Issue', render: (r) => <span>{r.label} <span className="text-xs text-muted-foreground">({r.issueCode})</span></span> },
    { header: 'Surfaced', className: 'px-3 py-2 tabular-nums', render: (r) => r.timesSurfaced },
    { header: 'Fixed', className: 'px-3 py-2 tabular-nums', render: (r) => r.timesFixed },
    { header: 'Dismissed', className: 'px-3 py-2 tabular-nums', render: (r) => r.timesDismissed },
    { header: 'Declined', className: 'px-3 py-2 tabular-nums', render: (r) => r.timesDeclined },
    { header: 'Fix rate', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => (r.fixRatePercent === null ? '—' : `${r.fixRatePercent}%`) },
    { header: 'Median time-to-fix', className: 'px-3 py-2 tabular-nums', render: (r) => (r.medianTimeToFixHours === null ? '—' : `${r.medianTimeToFixHours}h`) },
  ]

  // ── View 4: Point impact ──
  const pointImpactColumns: AdminColumn<PointImpactRow>[] = [
    { header: 'Issue', render: (r) => <span>{r.label} <span className="text-xs text-muted-foreground">({r.issueCode})</span></span> },
    { header: 'Total points lost', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.totalPointImpact },
    { header: 'Affected candidates', className: 'px-3 py-2 tabular-nums', render: (r) => r.affectedCandidateCount },
    { header: 'Avg per affected', className: 'px-3 py-2 tabular-nums', render: (r) => r.avgPointImpactPerAffected },
  ]

  // ── View 5: ATS failure matrix ──
  const atsColumns: AdminColumn<AtsMatrixRow>[] = [
    { header: 'Parser profile', render: (r) => r.parserLabel },
    { header: 'Analyses', className: 'px-3 py-2 tabular-nums', render: (r) => r.totalAnalyses },
    { header: 'Clean', className: 'px-3 py-2 tabular-nums', render: (r) => r.cleanCount },
    { header: 'Partial', className: 'px-3 py-2 tabular-nums', render: (r) => r.partialCount },
    { header: 'Failing', className: 'px-3 py-2 tabular-nums', render: (r) => r.failingCount },
    { header: 'Degraded rate', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => `${r.degradedRatePercent}%` },
    { header: 'Hard failure rate', className: 'px-3 py-2 tabular-nums', render: (r) => `${r.hardFailureRatePercent}%` },
    { header: 'Top failure reasons', render: (r) => (r.topFailureReasons.length ? r.topFailureReasons.join('; ') : '—') },
  ]

  // ── View 6: Co-occurrence ──
  const coOccurrenceColumns: AdminColumn<CoOccurrenceRow>[] = [
    { header: 'Issue A', render: (r) => <span>{r.labelA} <span className="text-xs text-muted-foreground">({r.issueCodeA})</span></span> },
    { header: 'Issue B', render: (r) => <span>{r.labelB} <span className="text-xs text-muted-foreground">({r.issueCodeB})</span></span> },
    { header: 'Joint count', className: 'px-3 py-2 tabular-nums', render: (r) => r.jointCount },
    { header: 'A alone', className: 'px-3 py-2 tabular-nums', render: (r) => r.countA },
    { header: 'B alone', className: 'px-3 py-2 tabular-nums', render: (r) => r.countB },
    { header: 'Lift', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => `${r.lift}×` },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resume issue analytics</h1>
        <p className="mt-1 text-muted-foreground">
          {data.totalAnalyses} resume analysis{data.totalAnalyses === 1 ? '' : 'es'} matching the current filters.
        </p>
      </div>

      {data.observations.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold tracking-tight">Observations</h2>
          <ul className="space-y-1.5 text-sm">
            {data.observations.map((obs) => (
              <li key={obs.id}>
                {obs.text}{' '}
                <Link
                  href={`${obs.linkedFilter.basePath}?${new URLSearchParams(obs.linkedFilter.params).toString()}`}
                  className="text-primary underline underline-offset-4"
                >
                  View filtered
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminFilterBar basePath={BASE_PATH} searchValue={filters.q} searchPlaceholder="Search issue code or label…" filters={filterOptions} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">1. Prevalence</h2>
            <p className="text-sm text-muted-foreground">Issue codes ranked by share of analyses containing them.</p>
          </div>
          <ExportCsvButton view="prevalence" params={params} />
        </div>
        <AdminDataTable columns={prevalenceColumns} rows={data.prevalence} rowKey={(r) => r.issueCode} emptyMessage="No issues match the current filters." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">2. Prevalence by segment</h2>
            <p className="text-sm text-muted-foreground">
              Pivoted by {PIVOT_LABELS[filters.pivot]}. Cells deviating more than 1.5σ from the overall rate are flagged ⚠. Segments under 5
              members show &quot;insufficient data.&quot;
            </p>
          </div>
          <ExportCsvButton view="segment" params={params} />
        </div>
        <AdminDataTable columns={segmentColumns} rows={data.segmentMatrix.rows} rowKey={(r) => r.issueCode} emptyMessage="No issues match the current filters." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">3. Fix rates</h2>
            <p className="text-sm text-muted-foreground">
              Sorted worst-performing first — the bottom of this list is the product backlog.
            </p>
          </div>
          <ExportCsvButton view="fix-rates" params={params} />
        </div>
        <AdminDataTable columns={fixRateColumns} rows={data.fixRates} rowKey={(r) => r.issueCode} emptyMessage="No issues match the current filters." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">4. Point impact</h2>
            <p className="text-sm text-muted-foreground">Total points lost per issue code across the population, and the average per affected candidate.</p>
          </div>
          <ExportCsvButton view="point-impact" params={params} />
        </div>
        <AdminDataTable columns={pointImpactColumns} rows={data.pointImpact} rowKey={(r) => r.issueCode} emptyMessage="No issues match the current filters." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">5. ATS failure matrix</h2>
            <p className="text-sm text-muted-foreground">
              Real, persisted per-analysis parse simulation (7 profiles — several bundle multiple real platforms, e.g. Greenhouse/Lever/Ashby/Workable
              share one profile). Failure reasons are the engine&apos;s real free-text output, not mapped to issue codes — that mapping doesn&apos;t
              exist in the underlying data yet.
            </p>
          </div>
          <ExportCsvButton view="ats-matrix" params={params} />
        </div>
        <AdminDataTable columns={atsColumns} rows={data.atsMatrix} rowKey={(r) => r.parserKey} emptyMessage="No ATS parse results match the current filters." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">6. Co-occurrence</h2>
            <p className="text-sm text-muted-foreground">
              Issue-code pairs ranked by lift — how many times more often they appear together than chance would predict on this population.
            </p>
          </div>
          <ExportCsvButton view="co-occurrence" params={params} />
        </div>
        <AdminDataTable
          columns={coOccurrenceColumns}
          rows={data.coOccurrence.slice(0, 100)}
          rowKey={(r) => `${r.issueCodeA}::${r.issueCodeB}`}
          emptyMessage="No co-occurring issue pairs in the current filters."
        />
      </section>
    </div>
  )
}
