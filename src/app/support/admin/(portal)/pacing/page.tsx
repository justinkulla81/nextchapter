import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { CANONICAL_TASK_MENU } from '@/lib/weekly/task-menu'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'

export const maxDuration = 30

interface CommittedActionLike {
  actionType?: string
  points: number
  completed: boolean
}

// Confirmations awarded once, whose real backing state (a profile timestamp)
// can drift ahead of whatever's stored in a given week's committedActions
// JSON — mirrors reconcileVerifiedActions' logic (action-verification.ts)
// for this narrower set (the assessment/optional-question verified types
// aren't included here since they'd need extra per-candidate queries this
// bulk view isn't worth the cost of).
function reconciledWeeklyPoints(
  actions: CommittedActionLike[],
  confirmedFlags: Partial<Record<string, boolean>>
): number {
  return actions.reduce((sum, a) => {
    // Some early seed/test fixtures predate the points economy and store a
    // `difficulty` field instead of `points` — coerce rather than let a
    // stray non-numeric value NaN-poison the whole row's total.
    const points = typeof a.points === 'number' ? a.points : 0
    if (a.actionType && a.actionType in confirmedFlags) {
      return sum + (confirmedFlags[a.actionType] ? points : 0)
    }
    return sum + (a.completed ? points : 0)
  }, 0)
}

interface PacingRow {
  id: string
  name: string
  employmentStatus: string
  employmentStatusRaw: string
  industry: string
  geo: string
  weekNumber: number
  weeklyPoints: number
  weeklyPointsTarget: number
  pointsNeeded: number
}

type PacingSortKey = 'name' | 'employmentStatus' | 'industry' | 'geo' | 'weeklyPoints' | 'weeklyPointsTarget' | 'pointsNeeded'

function comparePacingRows(a: PacingRow, b: PacingRow, sort: PacingSortKey): number {
  switch (sort) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'employmentStatus':
      return a.employmentStatus.localeCompare(b.employmentStatus)
    case 'industry':
      return a.industry.localeCompare(b.industry)
    case 'geo':
      return a.geo.localeCompare(b.geo)
    case 'weeklyPoints':
      return a.weeklyPoints - b.weeklyPoints
    case 'weeklyPointsTarget':
      return a.weeklyPointsTarget - b.weeklyPointsTarget
    case 'pointsNeeded':
      return a.pointsNeeded - b.pointsNeeded
  }
}

// Human labels for every action type this bulk view might tally — the
// canonical Search Action menu covers the recurring/one-time task types;
// the confirmation/setup types aren't part of that menu (they're onboarding
// checks, not a chosen Search Action) so they're named here directly.
const ACTION_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    CANONICAL_TASK_MENU.filter((t) => !!t.actionType).map((t) => [t.actionType as string, t.text])
  ),
  PROFILE_CONFIRM: 'Confirm profile details',
  INDUSTRY_CONFIRM: 'Confirm industry',
  FUNCTION_CONFIRM: 'Confirm function & experience',
  SALARY_CONFIRM: 'Confirm last salary',
  WORK_AUTHORIZATION: 'Confirm work authorization',
  WORKING_STYLE_QUIZ: 'Take the How I Work Best assessment',
  ANSWER_OPTIONAL_QUESTIONS: 'Answer optional job-search questions',
}

interface ActionStatRow {
  actionType: string
  label: string
  allTime: number
  thisWeek: number
}

type StatSortKey = 'label' | 'allTime' | 'thisWeek'

function buildStatSortHref(
  key: StatSortKey,
  currentKey: StatSortKey,
  currentDir: 'asc' | 'desc',
  preserved: Record<string, string>
): string {
  const nextDir = currentKey === key && currentDir === 'desc' ? 'asc' : 'desc'
  const params = new URLSearchParams({ ...preserved, statSort: key, statDir: nextDir })
  return `/support/admin/pacing?${params.toString()}`
}

export default async function AdminPacingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const q = (params.q ?? '').toLowerCase().trim()
  const segment = params.segment ?? ''
  const sort = (params.sort as PacingSortKey | undefined) ?? 'pointsNeeded'
  const dir = params.dir === 'desc' ? 'desc' : 'asc'
  const statSort = (params.statSort as StatSortKey | undefined) ?? 'allTime'
  const statDir = params.statDir === 'asc' ? 'asc' : 'desc'

  const thisMonday = getMondayOfWeek(new Date())

  const [candidates, allSprints] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { registrationCompletedAt: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentJobStatus: true,
        industryContext: true,
        primaryFunction: true,
        currentCity: true,
        currentState: true,
        profileConfirmedAt: true,
        industryConfirmedAt: true,
        functionConfirmedAt: true,
        salaryConfirmedAt: true,
        workAuthConfirmedAt: true,
        _count: { select: { weeklySprints: true } },
        weeklySprints: {
          where: { weekStartDate: thisMonday },
          select: { committedActions: true },
        },
      },
    }),
    prisma.weeklySprint.findMany({
      select: { weekStartDate: true, committedActions: true },
    }),
  ])

  let rows: PacingRow[] = candidates.map((c) => {
    // _count.weeklySprints already includes this week's row once it exists
    // (weeklySprints[0], fetched above filtered to thisMonday) — only add
    // the +1 when it doesn't exist yet. See getCandidateWeekNumber in
    // sprint.ts for the general-purpose version of this same fix.
    const weekNumber = c.weeklySprints[0] ? c._count.weeklySprints : c._count.weeklySprints + 1
    const weeklyPointsTarget = pointsNeededForA(weekNumber)
    const actions = (c.weeklySprints[0]?.committedActions as unknown as CommittedActionLike[]) ?? []
    const weeklyPoints = reconciledWeeklyPoints(actions, {
      PROFILE_CONFIRM: !!c.profileConfirmedAt,
      INDUSTRY_CONFIRM: !!c.industryConfirmedAt,
      FUNCTION_CONFIRM: !!c.functionConfirmedAt,
      SALARY_CONFIRM: !!c.salaryConfirmedAt,
      WORK_AUTHORIZATION: !!c.workAuthConfirmedAt,
    })

    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
      employmentStatus: c.currentJobStatus ? (CURRENT_JOB_STATUS_LABELS[c.currentJobStatus] ?? c.currentJobStatus) : '—',
      employmentStatusRaw: c.currentJobStatus ?? '',
      industry: c.industryContext || c.primaryFunction || '—',
      geo: [c.currentCity, c.currentState].filter(Boolean).join(', ') || '—',
      weekNumber,
      weeklyPoints,
      weeklyPointsTarget,
      pointsNeeded: weeklyPointsTarget - weeklyPoints,
    }
  })

  if (segment) rows = rows.filter((r) => r.employmentStatusRaw === segment)
  if (q) {
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.industry.toLowerCase().includes(q) || r.geo.toLowerCase().includes(q)
    )
  }
  rows.sort((a, b) => (dir === 'asc' ? comparePacingRows(a, b, sort) : comparePacingRows(b, a, sort)))

  // Action-type completion stats — all-time and this-week, across every
  // candidate's every Weekly Sprint. Reads the stored `completed` flag
  // directly (not re-reconciled per row like the pacing table above) —
  // acceptable for an aggregate count where the only possible drift is a
  // one-time confirmation undercounting itself, never overcounting.
  const allTimeCounts = new Map<string, number>()
  const thisWeekCounts = new Map<string, number>()
  for (const s of allSprints) {
    const actions = (s.committedActions as unknown as CommittedActionLike[]) ?? []
    const isThisWeek = s.weekStartDate.getTime() === thisMonday.getTime()
    for (const a of actions) {
      if (!a.actionType || !a.completed) continue
      allTimeCounts.set(a.actionType, (allTimeCounts.get(a.actionType) ?? 0) + 1)
      if (isThisWeek) thisWeekCounts.set(a.actionType, (thisWeekCounts.get(a.actionType) ?? 0) + 1)
    }
  }

  const knownTypes = new Set([...Object.keys(ACTION_TYPE_LABELS), ...allTimeCounts.keys()])
  const statRows: ActionStatRow[] = Array.from(knownTypes).map((actionType) => ({
    actionType,
    label: ACTION_TYPE_LABELS[actionType] ?? actionType,
    allTime: allTimeCounts.get(actionType) ?? 0,
    thisWeek: thisWeekCounts.get(actionType) ?? 0,
  }))
  statRows.sort((a, b) => {
    const cmp =
      statSort === 'label' ? a.label.localeCompare(b.label) : a[statSort] - b[statSort]
    return statDir === 'asc' ? cmp : -cmp
  })

  const preservedForStats: Record<string, string> = {}
  if (q) preservedForStats.q = q
  if (segment) preservedForStats.segment = segment
  preservedForStats.sort = sort
  preservedForStats.dir = dir

  const columns: AdminColumn<PacingRow>[] = [
    {
      header: 'Candidate',
      sortKey: 'name',
      render: (r) => (
        <Link href={`/support/admin/candidates/${r.id}`} className="text-primary underline underline-offset-4">
          {r.name}
        </Link>
      ),
    },
    { header: 'Employment status', sortKey: 'employmentStatus', render: (r) => r.employmentStatus },
    { header: 'Industry', sortKey: 'industry', render: (r) => r.industry },
    { header: 'Geo', sortKey: 'geo', render: (r) => r.geo },
    {
      header: 'Week',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => r.weekNumber,
    },
    {
      header: 'Points earned',
      sortKey: 'weeklyPoints',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.weeklyPoints,
    },
    {
      header: 'Points target',
      sortKey: 'weeklyPointsTarget',
      className: 'px-3 py-2 tabular-nums',
      render: (r) => r.weeklyPointsTarget,
    },
    {
      header: 'Points needed',
      sortKey: 'pointsNeeded',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => (
        <span className={r.pointsNeeded <= 0 ? 'text-success' : 'text-foreground'}>
          {r.pointsNeeded <= 0 ? `+${-r.pointsNeeded} over` : r.pointsNeeded}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pacing</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} candidate{rows.length === 1 ? '' : 's'} this week. Sorted by points still needed to hit
          this week&apos;s goal — negative (shown as &quot;over&quot;) means they&apos;ve already cleared it.
          Click a column header to sort.
        </p>
      </div>

      <AdminFilterBar
        basePath="/support/admin/pacing"
        searchValue={params.q ?? ''}
        searchPlaceholder="Search by name, industry, geo…"
        filters={[
          {
            key: 'segment',
            label: 'Employment status',
            value: segment,
            options: Object.entries(CURRENT_JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates match."
        sorting={{
          currentKey: sort,
          currentDir: dir,
          basePath: '/support/admin/pacing',
          baseParams: { ...(q ? { q } : {}), ...(segment ? { segment } : {}) },
        }}
      />

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Action activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every Search Action type, how many times it&apos;s ever been completed, and how many this week —
            across all candidates. Click a column to sort most/least.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">
                  <Link
                    href={buildStatSortHref('label', statSort, statDir, preservedForStats)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Action
                    {statSort === 'label' && <span aria-hidden="true">{statDir === 'asc' ? '▲' : '▼'}</span>}
                  </Link>
                </th>
                <th className="px-3 py-2 font-medium tabular-nums">
                  <Link
                    href={buildStatSortHref('allTime', statSort, statDir, preservedForStats)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    All-time
                    {statSort === 'allTime' && <span aria-hidden="true">{statDir === 'asc' ? '▲' : '▼'}</span>}
                  </Link>
                </th>
                <th className="px-3 py-2 font-medium tabular-nums">
                  <Link
                    href={buildStatSortHref('thisWeek', statSort, statDir, preservedForStats)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    This week
                    {statSort === 'thisWeek' && <span aria-hidden="true">{statDir === 'asc' ? '▲' : '▼'}</span>}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {statRows.map((r) => (
                <tr key={r.actionType} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{r.allTime}</td>
                  <td className="px-3 py-2 tabular-nums">{r.thisWeek}</td>
                </tr>
              ))}
              {statRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    No action activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
