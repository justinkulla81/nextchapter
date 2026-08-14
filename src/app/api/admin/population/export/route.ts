import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { rowsToCsv, csvContentHeaders } from '@/lib/admin/csv-export'
import { isSuppressedCell } from '@/lib/admin/cell-suppression'
import { getAllSegmentRow, getSuppressedSegmentTypeRows, listSnapshotWeeks } from '@/lib/admin/population-report'
import type { SegmentType } from '@/lib/analytics/population-metrics'

// CSV export for every section of the population report — Phase 2 Master
// Script, Part B: "Every view exports CSV" (Prompt 4, applied blanket
// across admin analytics by Prompt 5's page). Reads exclusively from
// PopulationSnapshot via src/lib/admin/population-report.ts, same as the
// page itself — never a live-table query. Segment breakdowns run through
// suppressSmallCells before ever reaching this response, same as the page.

const VALID_SECTIONS = [
  'composition',
  'funnel',
  'grades',
  'activity',
  'search_outcomes',
  'targets',
  'retention',
  'confidential',
] as const
type Section = (typeof VALID_SECTIONS)[number]

function parseWeek(param: string | null): Date | null {
  if (!param) return null
  const d = new Date(param)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(request: NextRequest) {
  await requireAdmin()

  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section') as Section | null
  if (!section || !VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: `section must be one of: ${VALID_SECTIONS.join(', ')}` }, { status: 400 })
  }
  const segmentType = (searchParams.get('segmentType') as SegmentType | null) ?? 'all'

  const weeks = await listSnapshotWeeks()
  if (weeks.length === 0) {
    return new NextResponse(rowsToCsv([]), { headers: csvContentHeaders(`population-${section}-no-data.csv`) })
  }
  const week = parseWeek(searchParams.get('week')) ?? weeks[0]

  let rows: Record<string, unknown>[] = []

  if (section === 'retention') {
    // Retention spans the full accumulated snapshot history, not one week
    // — same "read across every historical row" the page's Retention grid
    // does. Every entry comes from the all/all row's own cohortRetention
    // field, one snapshot week at a time.
    for (const w of weeks) {
      const allRow = await getAllSegmentRow(w)
      if (!allRow?.metrics.cohortRetention) continue
      for (const entry of allRow.metrics.cohortRetention) {
        if (entry.cohortSize < 5) continue // MIN_CELL_SIZE — cohort grid cells are individually suppressible too
        rows.push({
          snapshotWeek: w.toISOString().slice(0, 10),
          joinWeek: entry.joinWeekStartDate.slice(0, 10),
          cohortSize: entry.cohortSize,
          activeCount: entry.activeCount,
          activeSharePct: Math.round((entry.activeCount / entry.cohortSize) * 1000) / 10,
        })
      }
    }
    return new NextResponse(rowsToCsv(rows), { headers: csvContentHeaders('population-retention.csv') })
  }

  if (section === 'composition') {
    const segRows = await getSuppressedSegmentTypeRows(week, segmentType)
    const allRow = await getAllSegmentRow(week)
    const totalMembers = allRow?.memberCount ?? 0
    rows = segRows.map((r) =>
      isSuppressedCell(r)
        ? { segmentType, segmentValue: r.label, memberCount: 'insufficient data', sharePct: 'insufficient data' }
        : {
            segmentType,
            segmentValue: r.segmentValue,
            memberCount: r.memberCount,
            sharePct: totalMembers > 0 ? Math.round((r.memberCount / totalMembers) * 1000) / 10 : null,
          }
    )
    return new NextResponse(rowsToCsv(rows), {
      headers: csvContentHeaders(`population-composition-${segmentType}-${week.toISOString().slice(0, 10)}.csv`),
    })
  }

  if (section === 'targets') {
    const allRow = await getAllSegmentRow(week)
    const targets = allRow?.metrics.targets
    if (targets) {
      rows = [
        ...targets.topTargetRoles.map((t) => ({ dimension: 'target_role', value: t.value, count: t.count })),
        ...targets.topTargetIndustries.map((t) => ({ dimension: 'target_industry', value: t.value, count: t.count })),
        ...targets.topTargetMetros.map((t) => ({ dimension: 'current_metro', value: t.value, count: t.count })),
      ]
    }
    return new NextResponse(rowsToCsv(rows), {
      headers: csvContentHeaders(`population-targets-${week.toISOString().slice(0, 10)}.csv`),
    })
  }

  // funnel / grades / activity / search_outcomes / confidential — one row
  // per segmentValue within segmentType (suppressed), each carrying that
  // slice's relevant metrics fields flattened.
  const segRows = await getSuppressedSegmentTypeRows(week, segmentType)
  for (const r of segRows) {
    if (isSuppressedCell(r)) {
      rows.push({ segmentType, segmentValue: r.label, memberCount: 'insufficient data' })
      continue
    }
    const base = { segmentType, segmentValue: r.segmentValue, memberCount: r.memberCount }
    if (section === 'funnel') {
      for (const step of r.metrics.funnel) {
        rows.push({
          ...base,
          step: step.key,
          label: step.label,
          count: step.count,
          conversionFromStartPct: step.conversionFromStart,
          conversionFromPreviousPct: step.conversionFromPrevious,
          medianDaysFromPrevious: step.medianDaysFromPrevious,
        })
      }
    } else if (section === 'grades') {
      rows.push({
        ...base,
        gradeA: r.metrics.grades.compositeGradeDistribution.A ?? 0,
        gradeB: r.metrics.grades.compositeGradeDistribution.B ?? 0,
        gradeC: r.metrics.grades.compositeGradeDistribution.C ?? 0,
        gradeD: r.metrics.grades.compositeGradeDistribution.D ?? 0,
        gradeF: r.metrics.grades.compositeGradeDistribution.F ?? 0,
        noGrade: r.metrics.grades.noCompositeGradeCount,
        avgExperience: r.metrics.grades.componentAverages.experience,
        avgResume: r.metrics.grades.componentAverages.resume,
        avgEvidence: r.metrics.grades.componentAverages.evidence,
        avgEffort: r.metrics.grades.componentAverages.effort,
        avgMarket: r.metrics.grades.componentAverages.market,
        gradeMovementImproved: r.metrics.grades.gradeMovement?.improved ?? null,
        gradeMovementSame: r.metrics.grades.gradeMovement?.same ?? null,
        gradeMovementDeclined: r.metrics.grades.gradeMovement?.declined ?? null,
      })
    } else if (section === 'activity') {
      rows.push({
        ...base,
        outreachMedian: r.metrics.activity.outreachThisWeek.median,
        outreachP90: r.metrics.activity.outreachThisWeek.p90,
        applicationsMedian: r.metrics.activity.applicationsThisWeek.median,
        applicationsP90: r.metrics.activity.applicationsThisWeek.p90,
        linkedinMedian: r.metrics.activity.linkedinPostsThisWeek.median,
        linkedinP90: r.metrics.activity.linkedinPostsThisWeek.p90,
        communityMedian: r.metrics.activity.communityPostsThisWeek.median,
        communityP90: r.metrics.activity.communityPostsThisWeek.p90,
        sprintTargetHitSharePct: r.metrics.activity.sprintTargetHitShare,
        activeThisWeekSharePct: r.metrics.activity.activeThisWeekShare,
        dormant21PlusSharePct: r.metrics.activity.dormant21PlusShare,
      })
    } else if (section === 'search_outcomes') {
      rows.push({
        ...base,
        appliedCount: r.metrics.searchOutcomes.appliedCount,
        respondedCount: r.metrics.searchOutcomes.respondedCount,
        interviewCount: r.metrics.searchOutcomes.interviewCount,
        offerCount: r.metrics.searchOutcomes.offerCount,
        applicationToResponseRatePct: r.metrics.searchOutcomes.applicationToResponseRate,
        responseToInterviewRatePct: r.metrics.searchOutcomes.responseToInterviewRate,
        interviewToOfferRatePct: r.metrics.searchOutcomes.interviewToOfferRate,
        medianSearchDurationDaysForHired: r.metrics.searchOutcomes.medianSearchDurationDaysForHired,
        hiredSampleSize: r.metrics.searchOutcomes.hiredSampleSize,
      })
    } else if (section === 'confidential') {
      rows.push({
        ...base,
        confidentialCount: r.metrics.confidential.confidentialCount,
        shareConfidentialPct: r.metrics.confidential.shareConfidential,
      })
    }
  }

  return new NextResponse(rowsToCsv(rows), {
    headers: csvContentHeaders(`population-${section}-${segmentType}-${week.toISOString().slice(0, 10)}.csv`),
  })
}
