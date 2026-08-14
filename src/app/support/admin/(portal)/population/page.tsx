import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import {
  getAllSegmentRow,
  getSuppressedSegmentTypeRows,
  listSnapshotWeeks,
  SEGMENT_TYPE_LABELS,
  type SnapshotRow,
} from '@/lib/admin/population-report'
import { isSuppressedCell, type MaybeSuppressed } from '@/lib/admin/cell-suppression'
import { generateObservations, type SegmentMetricInput, type FunnelStepInput } from '@/lib/admin/observations'
import type { SegmentType } from '@/lib/analytics/population-metrics'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { GenerateSnapshotButton } from './GenerateSnapshotButton'
import { WeekPicker } from './WeekPicker'

export const metadata: Metadata = { robots: { index: false, follow: false } }
export const maxDuration = 30

const BASE_PATH = '/support/admin/population'
const COMPOSITION_SEGMENT_TYPES: SegmentType[] = ['seniority', 'function', 'industry', 'metro', 'employment_status', 'usage_tier']

const SENIORITY_LABEL: Record<string, string> = { EARLY: 'Early career', MID: 'Mid-level', SENIOR: 'Senior', EXECUTIVE: 'Executive' }

function segmentValueLabel(segmentType: SegmentType, value: string): string {
  if (segmentType === 'seniority') return SENIORITY_LABEL[value] ?? value
  if (segmentType === 'employment_status') return CURRENT_JOB_STATUS_LABELS[value as keyof typeof CURRENT_JOB_STATUS_LABELS] ?? value
  return value
}

function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${n}%`
}

function fmtNum(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : String(n)
}

function fmtDays(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${n} day${n === 1 ? '' : 's'}`
}

function weekDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function DeltaBadge({ current, previous }: { current: number | null; previous: number | null | undefined }) {
  if (current === null || previous === null || previous === undefined) return null
  const delta = Math.round((current - previous) * 10) / 10
  if (delta === 0) return <span className="text-xs text-muted-foreground">flat</span>
  const up = delta > 0
  return (
    <span className={up ? 'text-xs text-green-700' : 'text-xs text-red-600'}>
      {up ? '+' : ''}
      {delta} vs last week
    </span>
  )
}

function SectionCard({
  title,
  csvHref,
  children,
}: {
  title: string
  csvHref?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {csvHref && (
          <a href={csvHref} className="text-sm text-brand underline underline-offset-4">
            Export CSV
          </a>
        )}
      </div>
      {children}
    </section>
  )
}

function SuppressedRow({ label }: { label: string }) {
  return (
    <tr>
      <td className="px-3 py-2 text-muted-foreground">{label}</td>
      <td className="px-3 py-2 text-muted-foreground italic" colSpan={3}>
        Insufficient data (fewer than 5 members)
      </td>
    </tr>
  )
}

// ── Composition ──────────────────────────────────────────────────────

function CompositionSection({
  weekStartDate,
  breakdowns,
  previousBreakdowns,
  totalMembers,
  backgroundStrength,
}: {
  weekStartDate: Date
  breakdowns: Record<SegmentType, MaybeSuppressed<SnapshotRow>[]>
  previousBreakdowns: Record<SegmentType, MaybeSuppressed<SnapshotRow>[]> | null
  totalMembers: number
  backgroundStrength: Record<string, number> | undefined
}) {
  return (
    <SectionCard title="Composition">
      <p className="text-sm text-muted-foreground">
        {totalMembers} total members as of the week of {weekDateLabel(weekStartDate)}. Every breakdown below is suppressed
        below 5 members per segment (Prompt 8) — never shown as a raw count.
      </p>
      {COMPOSITION_SEGMENT_TYPES.map((segType) => {
        const rows = breakdowns[segType]
        const prevRows = previousBreakdowns?.[segType]
        return (
          <div key={segType} className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{SEGMENT_TYPE_LABELS[segType]}</h3>
              <a
                href={`/api/admin/population/export?section=composition&segmentType=${segType}&week=${weekStartDate.toISOString()}`}
                className="text-xs text-brand underline underline-offset-4"
              >
                Export CSV
              </a>
            </div>
            {segType === 'employment_status' && (
              <p className="text-xs text-muted-foreground">
                No independent &quot;persona&quot; field exists in this codebase — the persona picker writes directly into
                this same employment-status field, so this one breakdown covers both.
              </p>
            )}
            {segType === 'usage_tier' && (
              <p className="text-xs text-muted-foreground">
                Derived tercile split of lifetime activity actions (outreach + applications + LinkedIn posts + community
                posts + Sprint targets hit) — not a stored field.
              </p>
            )}
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">Segment</th>
                    <th className="px-3 py-2 font-medium">Members</th>
                    <th className="px-3 py-2 font-medium">Share</th>
                    <th className="px-3 py-2 font-medium">WoW</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                        No real values recorded for this dimension yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((row) =>
                    isSuppressedCell(row) ? (
                      <SuppressedRow key={row.label} label={segmentValueLabel(segType, row.label)} />
                    ) : (
                      <tr key={row.segmentValue} className="border-t border-border">
                        <td className="px-3 py-2">{segmentValueLabel(segType, row.segmentValue)}</td>
                        <td className="px-3 py-2 tabular-nums">{row.memberCount}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtPct(totalMembers > 0 ? Math.round((row.memberCount / totalMembers) * 1000) / 10 : null)}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const prevRow = prevRows?.find((p) => !isSuppressedCell(p) && p.segmentValue === row.segmentValue)
                            return (
                              <DeltaBadge
                                current={row.memberCount}
                                previous={prevRow && !isSuppressedCell(prevRow) ? prevRow.memberCount : undefined}
                              />
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      {backgroundStrength && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Background strength (derived)</h3>
          <p className="text-xs text-muted-foreground">
            Not one of the schema&apos;s canonical segment types — a simplified bucket of the real{' '}
            <code>pedigreeBonus</code> field (0-6 scale), shown here only for the whole population, not crossed with
            other segments.
          </p>
          <div className="flex gap-4 text-sm">
            {Object.entries(backgroundStrength).map(([bucket, count]) => (
              <span key={bucket}>
                {bucket.replace(/_/g, ' ')}: <span className="tabular-nums font-medium">{count < 5 ? 'insufficient data' : count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ── Funnel ──────────────────────────────────────────────────────────

function FunnelSection({ weekStartDate, allRow }: { weekStartDate: Date; allRow: SnapshotRow }) {
  const hasOverConversion = allRow.metrics.funnel.some((s) => (s.conversionFromPrevious ?? 0) > 100)
  return (
    <SectionCard title="Funnel" csvHref={`/api/admin/population/export?section=funnel&segmentType=all&week=${weekStartDate.toISOString()}`}>
      <p className="text-sm text-muted-foreground">
        Resume uploaded → registered → activation complete → first reference requested → 5 references returned → both
        assessments → Dossier complete. The largest drop-off is the next thing to fix.
      </p>
      {hasOverConversion && (
        <p className="text-xs text-muted-foreground">
          A step showing over 100% conversion from the previous step means these steps aren&apos;t strictly nested in
          the real data — e.g. a member can be registered without a tracked Resume row (profiles created directly,
          bypassing the resume-upload flow). This is a real data characteristic, not a computation error.
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Step</th>
              <th className="px-3 py-2 font-medium">Count</th>
              <th className="px-3 py-2 font-medium">Conversion from start</th>
              <th className="px-3 py-2 font-medium">Conversion from previous step</th>
              <th className="px-3 py-2 font-medium">Median days from previous step</th>
            </tr>
          </thead>
          <tbody>
            {allRow.metrics.funnel.map((step) => (
              <tr key={step.key} className="border-t border-border">
                <td className="px-3 py-2">{step.label}</td>
                <td className="px-3 py-2 tabular-nums">{step.count}</td>
                <td className="px-3 py-2 tabular-nums">{fmtPct(step.conversionFromStart)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtPct(step.conversionFromPrevious)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {step.medianDaysFromPrevious === null && (step.key === 'activation_complete' || step.key === 'dossier_complete') ? (
                    <span className="text-muted-foreground italic" title="No completion timestamp is persisted for this step — it's computed live from current state, never archived.">
                      not tracked
                    </span>
                  ) : (
                    fmtDays(step.medianDaysFromPrevious)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

// ── Grades ──────────────────────────────────────────────────────────

function GradesSection({ weekStartDate, allRow }: { weekStartDate: Date; allRow: SnapshotRow }) {
  const { grades } = allRow.metrics
  const gradeOrder = ['A', 'B', 'C', 'D', 'F']
  const movement = grades.gradeMovement
  const movementSuppressed = movement !== null && movement.sampleSize < 5

  return (
    <SectionCard title="Grades" csvHref={`/api/admin/population/export?section=grades&segmentType=all&week=${weekStartDate.toISOString()}`}>
      <p className="text-sm text-muted-foreground">
        Composite Market Reality Grade and its 5 components (Experience, Resume, Evidence, Effort, Market — Market is
        never weighted directly, it caps the composite one band). Grade distribution and component averages are read
        from this week&apos;s composite score. Week-over-week movement is computed from the older, weekly-archived
        six-category Market Reality Snapshot instead — the composite score itself has no persisted weekly history in
        this codebase.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        {gradeOrder.map((g) => (
          <span key={g}>
            {g}: <span className="tabular-nums font-medium">{grades.compositeGradeDistribution[g] ?? 0}</span>
          </span>
        ))}
        <span className="text-muted-foreground">No grade yet: {grades.noCompositeGradeCount}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <span>Experience: {fmtNum(grades.componentAverages.experience)}</span>
        <span>Resume: {fmtNum(grades.componentAverages.resume)}</span>
        <span>Evidence: {fmtNum(grades.componentAverages.evidence)}</span>
        <span>Effort: {fmtNum(grades.componentAverages.effort)}</span>
        <span>Market: {fmtNum(grades.componentAverages.market)}</span>
      </div>
      <div className="text-sm">
        <span className="font-medium">Grade movement (this week vs last, members present in both): </span>
        {movement === null ? (
          <span className="text-muted-foreground italic">Not enough Market Reality Snapshot history yet — needs two recorded weeks.</span>
        ) : movementSuppressed ? (
          <span className="text-muted-foreground italic">Insufficient data (fewer than 5 members present in both weeks)</span>
        ) : (
          <span>
            {movement.improved} improved, {movement.same} held steady, {movement.declined} declined (n={movement.sampleSize})
          </span>
        )}
      </div>
    </SectionCard>
  )
}

// ── Activity ────────────────────────────────────────────────────────

function ActivitySection({ weekStartDate, allRow }: { weekStartDate: Date; allRow: SnapshotRow }) {
  const { activity } = allRow.metrics
  return (
    <SectionCard title="Activity" csvHref={`/api/admin/population/export?section=activity&segmentType=all&week=${weekStartDate.toISOString()}`}>
      <p className="text-sm text-muted-foreground">
        Median and p90 are computed over each member&apos;s count of that action WITHIN this snapshot&apos;s week
        (Monday–Sunday), not lifetime totals — comparable week over week.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Median (this week)</th>
              <th className="px-3 py-2 font-medium">p90 (this week)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Outreach', activity.outreachThisWeek],
              ['Applications', activity.applicationsThisWeek],
              ['LinkedIn posts', activity.linkedinPostsThisWeek],
              ['Community posts', activity.communityPostsThisWeek],
            ].map(([label, stat]) => (
              <tr key={label as string} className="border-t border-border">
                <td className="px-3 py-2">{label as string}</td>
                <td className="px-3 py-2 tabular-nums">{(stat as { median: number }).median}</td>
                <td className="px-3 py-2 tabular-nums">{(stat as { p90: number }).p90}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span>Sprint Target hit this week: {fmtPct(activity.sprintTargetHitShare)}</span>
        <span>Active this week: {fmtPct(activity.activeThisWeekShare)}</span>
        <span>Dormant 21+ days: {fmtPct(activity.dormant21PlusShare)}</span>
      </div>
    </SectionCard>
  )
}

// ── Search outcomes ──────────────────────────────────────────────────

function SearchOutcomesSection({ weekStartDate, allRow }: { weekStartDate: Date; allRow: SnapshotRow }) {
  const so = allRow.metrics.searchOutcomes
  const durationSuppressed = so.hiredSampleSize > 0 && so.hiredSampleSize < 5
  return (
    <SectionCard
      title="Search outcomes"
      csvHref={`/api/admin/population/export?section=search_outcomes&segmentType=all&week=${weekStartDate.toISOString()}`}
    >
      <p className="text-sm text-muted-foreground">
        &quot;Response&quot; has no dedicated timestamp on a job posting — proxied as an interview landed OR a decline
        being recorded after applying. Median search duration uses admin-approved Offer Bounty claims (the only
        confirmed &quot;I got hired&quot; signal in this codebase) as the hire date, against registration date as the
        search start.
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <span>Applied: {so.appliedCount}</span>
        <span>Responded: {so.respondedCount}</span>
        <span>Interviewed: {so.interviewCount}</span>
        <span>Offered: {so.offerCount}</span>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span>Application → response: {fmtPct(so.applicationToResponseRate)}</span>
        <span>Response → interview: {fmtPct(so.responseToInterviewRate)}</span>
        <span>Interview → offer: {fmtPct(so.interviewToOfferRate)}</span>
      </div>
      <div className="text-sm">
        Median search duration for confirmed hires:{' '}
        {so.hiredSampleSize === 0 ? (
          <span className="text-muted-foreground italic">No approved Offer Bounty claims yet — real n=0, not fabricated.</span>
        ) : durationSuppressed ? (
          <span className="text-muted-foreground italic">Insufficient data (fewer than 5 confirmed hires)</span>
        ) : (
          <span>
            {fmtDays(so.medianSearchDurationDaysForHired)} (n={so.hiredSampleSize})
          </span>
        )}
      </div>
    </SectionCard>
  )
}

// ── Targets and demand ────────────────────────────────────────────────

function TargetsSection({ weekStartDate, allRow }: { weekStartDate: Date; allRow: SnapshotRow }) {
  const targets = allRow.metrics.targets
  if (!targets) return null
  return (
    <SectionCard title="Targets and demand" csvHref={`/api/admin/population/export?section=targets&week=${weekStartDate.toISOString()}`}>
      <p className="text-sm text-muted-foreground">
        Cross-referencing against ncrawl posting volume to surface thin markets was investigated and NOT built in this
        pass: no aggregate-by-industry/metro posting-volume table exists anywhere in this codebase today (checked
        MarketDifficultySnapshot — per-candidate, not an aggregate; MarketConditionsSnapshot — a live cache with no
        history; ExclusiveJobPosting — a small curated list, not raw market volume). Building a new ncrawl aggregation
        pipeline is out of scope for this pass. Rows below with fewer than 5 members are omitted, not suppressed with
        a placeholder — this list is a top-10 ranking, not a full segment breakdown.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Top target roles</h3>
          <ul className="space-y-0.5 text-sm">
            {targets.topTargetRoles.filter((t) => t.count >= 5).map((t) => (
              <li key={t.value}>
                {t.value} <span className="tabular-nums text-muted-foreground">({t.count})</span>
              </li>
            ))}
            {targets.topTargetRoles.filter((t) => t.count >= 5).length === 0 && (
              <li className="text-muted-foreground italic">No role has 5+ members targeting it yet.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Top target industries</h3>
          <ul className="space-y-0.5 text-sm">
            {targets.topTargetIndustries.filter((t) => t.count >= 5).map((t) => (
              <li key={t.value}>
                {t.value} <span className="tabular-nums text-muted-foreground">({t.count})</span>
              </li>
            ))}
            {targets.topTargetIndustries.filter((t) => t.count >= 5).length === 0 && (
              <li className="text-muted-foreground italic">No industry has 5+ members targeting it yet.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Current metro concentration</h3>
          <p className="mb-1 text-xs text-muted-foreground">No stated &quot;target metro&quot; field exists — this is current location, not a search target.</p>
          <ul className="space-y-0.5 text-sm">
            {targets.topTargetMetros.filter((t) => t.count >= 5).map((t) => (
              <li key={t.value}>
                {t.value} <span className="tabular-nums text-muted-foreground">({t.count})</span>
              </li>
            ))}
            {targets.topTargetMetros.filter((t) => t.count >= 5).length === 0 && (
              <li className="text-muted-foreground italic">No metro has 5+ members yet.</li>
            )}
          </ul>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Retention ──────────────────────────────────────────────────────────

function RetentionSection({
  grid,
}: {
  grid: { joinWeek: string; cohortSize: number; cells: (number | null)[] }[] // cells[i] = active count at i weeks after joining, null = not yet reached / suppressed
}) {
  return (
    <SectionCard title="Retention" csvHref="/api/admin/population/export?section=retention">
      <p className="text-sm text-muted-foreground">
        Weekly cohort retention — members joining week N, still active at weeks N+1…N+12. Built entirely from
        accumulated PopulationSnapshot history (Prompt 6), not a live recompute. This is a brand-new feature — the grid
        will be sparse or mostly empty until several more weeks of real snapshots exist, which is correct and expected,
        not a bug.
      </p>
      {grid.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No cohorts recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Join week</th>
                <th className="px-3 py-2 font-medium">Size</th>
                {Array.from({ length: 13 }, (_, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium">
                    W{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((cohort) => (
                <tr key={cohort.joinWeek} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{weekDateLabel(new Date(cohort.joinWeek))}</td>
                  <td className="px-3 py-2 tabular-nums">{cohort.cohortSize < 5 ? 'n<5' : cohort.cohortSize}</td>
                  {cohort.cells.map((c, i) => (
                    <td key={i} className="px-2 py-2 text-center tabular-nums">
                      {cohort.cohortSize < 5 ? '—' : c === null ? '' : `${Math.round((c / cohort.cohortSize) * 100)}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ── Confidential mode ────────────────────────────────────────────────

function ConfidentialSection({
  weekStartDate,
  allRow,
  employmentStatusRows,
}: {
  weekStartDate: Date
  allRow: SnapshotRow
  employmentStatusRows: MaybeSuppressed<SnapshotRow>[]
}) {
  return (
    <SectionCard
      title="Confidential mode"
      csvHref={`/api/admin/population/export?section=confidential&segmentType=employment_status&week=${weekStartDate.toISOString()}`}
    >
      <p className="text-sm text-muted-foreground">
        No dedicated &quot;Confidential Search Mode&quot; boolean exists — proxied as <code>privacyTier === &apos;STEALTH&apos;</code>
        {' '}(&quot;visible only to pre-approved companies&quot;), the closest real value to the spec&apos;s concept.
        Broken down by employment status, standing in for persona (see Composition section note).
      </p>
      <p className="text-sm">
        Overall: {fmtPct(allRow.metrics.confidential.shareConfidential)} in Confidential Search Mode ({allRow.metrics.confidential.confidentialCount} of {allRow.memberCount})
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Employment status / persona</th>
              <th className="px-3 py-2 font-medium">Share confidential</th>
            </tr>
          </thead>
          <tbody>
            {employmentStatusRows.map((row) =>
              isSuppressedCell(row) ? (
                <tr key={row.label}>
                  <td className="px-3 py-2 text-muted-foreground">{segmentValueLabel('employment_status', row.label)}</td>
                  <td className="px-3 py-2 text-muted-foreground italic">Insufficient data</td>
                </tr>
              ) : (
                <tr key={row.segmentValue} className="border-t border-border">
                  <td className="px-3 py-2">{segmentValueLabel('employment_status', row.segmentValue)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtPct(row.metrics.confidential.shareConfidential)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function PopulationReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const mode = params.mode === 'alltime' ? 'alltime' : 'week'

  const weeks = await listSnapshotWeeks()

  if (weeks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Population report</h1>
          <p className="mt-1 text-muted-foreground">
            No snapshots recorded yet. This report reads exclusively from weekly PopulationSnapshot rows (never live
            tables) — the Monday 00:15 UTC cron hasn&apos;t run yet, or you&apos;re on a fresh environment. Generate this
            week&apos;s snapshot to populate the report.
          </p>
        </div>
        <GenerateSnapshotButton />
      </div>
    )
  }

  const selectedWeekParam = params.week ? new Date(params.week) : null
  const weekIndex = selectedWeekParam
    ? weeks.findIndex((w) => w.getTime() === selectedWeekParam.getTime())
    : 0
  const weekStartDate = weekIndex >= 0 ? weeks[weekIndex] : weeks[0]
  const previousWeek = weeks[weeks.indexOf(weekStartDate) + 1] ?? null

  const [allRow, previousAllRow] = await Promise.all([
    getAllSegmentRow(weekStartDate),
    previousWeek ? getAllSegmentRow(previousWeek) : Promise.resolve(null),
  ])

  if (!allRow) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Population report</h1>
        <p className="text-muted-foreground">Could not load the all/all snapshot row for this week. Try regenerating it.</p>
        <GenerateSnapshotButton />
      </div>
    )
  }

  const breakdowns: Record<SegmentType, MaybeSuppressed<SnapshotRow>[]> = {} as Record<SegmentType, MaybeSuppressed<SnapshotRow>[]>
  const previousBreakdowns: Record<SegmentType, MaybeSuppressed<SnapshotRow>[]> = {} as Record<SegmentType, MaybeSuppressed<SnapshotRow>[]>
  for (const segType of COMPOSITION_SEGMENT_TYPES) {
    breakdowns[segType] = await getSuppressedSegmentTypeRows(weekStartDate, segType)
    if (previousWeek) previousBreakdowns[segType] = await getSuppressedSegmentTypeRows(previousWeek, segType)
  }
  const employmentStatusRows = breakdowns.employment_status

  // ── Observations ──────────────────────────────────────────────────
  const funnelSteps: FunnelStepInput[] = allRow.metrics.funnel.map((step) => {
    const prevStep = previousAllRow?.metrics.funnel.find((s) => s.key === step.key)
    return {
      stepName: step.label,
      conversionThisWeek: step.conversionFromStart ?? 0,
      conversionLastWeek: prevStep?.conversionFromStart ?? null,
    }
  })
  const overallEvidence = allRow.metrics.grades.componentAverages.evidence
  const segmentRates: SegmentMetricInput[] = []
  if (overallEvidence !== null) {
    for (const row of breakdowns.function) {
      if (isSuppressedCell(row)) continue
      const segEvidence = row.metrics.grades.componentAverages.evidence
      if (segEvidence === null) continue
      segmentRates.push({
        segmentType: 'function',
        segmentValue: row.segmentValue,
        metricLabel: 'Your Evidence score',
        unit: 'points',
        segmentRate: segEvidence,
        overallRate: overallEvidence,
        memberCount: row.memberCount,
      })
    }
  }
  const observations = generateObservations({ funnelSteps, segmentRates })

  // ── Retention grid across full history ──────────────────────────────
  const allWeeksAllRows = await Promise.all(weeks.map((w) => getAllSegmentRow(w)))
  const cohortMap = new Map<string, { cohortSize: number; cellsByWeeksAfter: Map<number, number> }>()
  for (const row of allWeeksAllRows) {
    if (!row?.metrics.cohortRetention) continue
    for (const entry of row.metrics.cohortRetention) {
      const joinWeek = new Date(entry.joinWeekStartDate)
      const weeksAfter = Math.round((row.weekStartDate.getTime() - joinWeek.getTime()) / (7 * 24 * 60 * 60 * 1000))
      if (weeksAfter < 0 || weeksAfter > 12) continue
      const existing = cohortMap.get(entry.joinWeekStartDate) ?? { cohortSize: entry.cohortSize, cellsByWeeksAfter: new Map() }
      existing.cohortSize = entry.cohortSize
      existing.cellsByWeeksAfter.set(weeksAfter, entry.activeCount)
      cohortMap.set(entry.joinWeekStartDate, existing)
    }
  }
  const retentionGrid = [...cohortMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([joinWeek, data]) => ({
      joinWeek,
      cohortSize: data.cohortSize,
      cells: Array.from({ length: 13 }, (_, i) => data.cellsByWeeksAfter.get(i) ?? null),
    }))

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Population report</h1>
          <p className="mt-1 text-muted-foreground">
            Aggregate-only, minimum cell size of 5. Reads exclusively from weekly snapshots.
          </p>
        </div>
        <GenerateSnapshotButton />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-border p-1">
          <Link
            href={`${BASE_PATH}?mode=week&week=${weekStartDate.toISOString()}`}
            className={`rounded px-3 py-1 text-sm font-medium ${mode === 'week' ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            This week
          </Link>
          <Link
            href={`${BASE_PATH}?mode=alltime`}
            className={`rounded px-3 py-1 text-sm font-medium ${mode === 'alltime' ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            All time
          </Link>
        </div>
        {mode === 'week' && (
          <WeekPicker
            weeks={weeks.map((w) => w.toISOString())}
            selected={weekStartDate.toISOString()}
            basePath={BASE_PATH}
            mode={mode}
          />
        )}
      </div>

      {observations.length > 0 && (
        <section className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-4">
          <h2 className="text-sm font-semibold">Observations</h2>
          <ul className="space-y-2">
            {observations.map((o) => (
              <li key={o.id} className="text-sm">
                {o.text}{' '}
                <Link
                  href={{ pathname: o.linkedFilter.basePath, query: o.linkedFilter.params }}
                  className="text-brand underline underline-offset-4"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === 'alltime' ? (
        <SectionCard title="Trend over time">
          <p className="text-sm text-muted-foreground">
            Headline aggregate figures across every recorded week. With {weeks.length} week{weeks.length === 1 ? '' : 's'}{' '}
            of history so far, this table is necessarily short — it grows every Monday.
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Week</th>
                  <th className="px-3 py-2 font-medium">Members</th>
                  <th className="px-3 py-2 font-medium">Dossier complete</th>
                  <th className="px-3 py-2 font-medium">Active this week</th>
                  <th className="px-3 py-2 font-medium">A-grade share</th>
                  <th className="px-3 py-2 font-medium">Confidential share</th>
                </tr>
              </thead>
              <tbody>
                {allWeeksAllRows.filter((r): r is SnapshotRow => r !== null).map((row) => {
                  const dossierStep = row.metrics.funnel.find((s) => s.key === 'dossier_complete')
                  const gradeTotal = Object.values(row.metrics.grades.compositeGradeDistribution).reduce((a, b) => a + b, 0)
                  const aShare = gradeTotal > 0 ? Math.round(((row.metrics.grades.compositeGradeDistribution.A ?? 0) / gradeTotal) * 1000) / 10 : null
                  return (
                    <tr key={row.weekStartDate.toISOString()} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">{weekDateLabel(row.weekStartDate)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.memberCount}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtPct(dossierStep?.conversionFromStart ?? null)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtPct(row.metrics.activity.activeThisWeekShare)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtPct(aShare)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtPct(row.metrics.confidential.shareConfidential)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : (
        <>
          <CompositionSection
            weekStartDate={weekStartDate}
            breakdowns={breakdowns}
            previousBreakdowns={previousWeek ? previousBreakdowns : null}
            totalMembers={allRow.memberCount}
            backgroundStrength={allRow.metrics.backgroundStrength}
          />
          <FunnelSection weekStartDate={weekStartDate} allRow={allRow} />
          <GradesSection weekStartDate={weekStartDate} allRow={allRow} />
          <ActivitySection weekStartDate={weekStartDate} allRow={allRow} />
          <SearchOutcomesSection weekStartDate={weekStartDate} allRow={allRow} />
          <TargetsSection weekStartDate={weekStartDate} allRow={allRow} />
        </>
      )}

      <RetentionSection grid={retentionGrid} />
      <ConfidentialSection weekStartDate={weekStartDate} allRow={allRow} employmentStatusRows={employmentStatusRows} />
    </div>
  )
}
