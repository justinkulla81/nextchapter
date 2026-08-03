import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import type { Grade } from '@/lib/scoring/grade'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'

export const maxDuration = 30

const GRADE_RANK: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }

interface Row {
  id: string
  name: string
  email: string
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
  geoFlex: string
  privacyTier: string
  requestedAt: Date | null
  execDossierGrade: Grade | null
  currentlySurfaced: boolean
  onSprintTarget: boolean
  resumeScore: number | null
}

type SortKey =
  | 'name'
  | 'function'
  | 'level'
  | 'targetRole'
  | 'industry'
  | 'geo'
  | 'resumeScore'
  | 'execDossierGrade'
  | 'sprintTarget'
  | 'privacyTier'
  | 'requestedAt'

function formatGeo(city: string | null, state: string | null, country: string): string {
  return [city, state, country === 'US' ? null : country].filter(Boolean).join(', ') || '—'
}

function compareRows(a: Row, b: Row, sort: SortKey): number {
  switch (sort) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'function':
      return a.primaryFunction.localeCompare(b.primaryFunction)
    case 'level':
      return a.level.localeCompare(b.level)
    case 'targetRole':
      return a.targetRoleType.localeCompare(b.targetRoleType)
    case 'industry':
      return a.industry.localeCompare(b.industry)
    case 'geo':
      return a.geo.localeCompare(b.geo)
    case 'resumeScore':
      return (a.resumeScore ?? -1) - (b.resumeScore ?? -1)
    case 'execDossierGrade':
      return (a.execDossierGrade ? GRADE_RANK[a.execDossierGrade] : 0) - (b.execDossierGrade ? GRADE_RANK[b.execDossierGrade] : 0)
    case 'sprintTarget':
      return Number(a.onSprintTarget) - Number(b.onSprintTarget)
    case 'privacyTier':
      return a.privacyTier.localeCompare(b.privacyTier)
    case 'requestedAt':
      return (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0)
  }
}

export default async function RecruiterDatabaseAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const q = (params.q ?? '').toLowerCase().trim()
  const sort = (params.sort as SortKey | undefined) ?? 'requestedAt'
  const dir = params.dir === 'asc' ? 'asc' : params.dir === 'desc' ? 'desc' : 'desc'

  const [candidates, authUsers] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { recruiterDatabaseOptIn: true },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        primaryFunction: true,
        highestLevelReached: true,
        targetRoleType: true,
        industryContext: true,
        currentCity: true,
        currentState: true,
        currentCountry: true,
        remotePreference: true,
        openToRelocation: true,
        privacyTier: true,
        recruiterDatabaseRequestedAt: true,
        hireabilityReports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { hireabilityGradeAtGeneration: true },
        },
        resumes: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
          select: { atsScore: true },
        },
        // Sourced from WeeklyBadgeEarned, the real currently-written record —
        // SundayNightReport.onAList is legacy and nothing writes to it
        // anymore (see src/lib/badges/weekly-badge-archive.ts).
        weeklyBadgesEarned: {
          where: { badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
          orderBy: { weekStartDate: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    }),
    listAllAuthUsers(),
  ])

  let rows: Row[] = candidates.map((c) => {
    const grade = normalizeGradeSnapshot(c.hireabilityReports[0]?.hireabilityGradeAtGeneration)
    const execDossierGrade = grade?.grade ?? null
    const geoFlex = [
      c.remotePreference ? c.remotePreference : null,
      c.openToRelocation ? 'open to relocation' : null,
    ]
      .filter(Boolean)
      .join(' · ')
    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
      email: getAuthEmail(authUsers, c.userId),
      primaryFunction: c.primaryFunction ?? '—',
      level: c.highestLevelReached ?? '—',
      targetRoleType: c.targetRoleType ?? '—',
      industry: c.industryContext ?? '—',
      geo: formatGeo(c.currentCity, c.currentState, c.currentCountry),
      geoFlex: geoFlex || '—',
      privacyTier: c.privacyTier,
      requestedAt: c.recruiterDatabaseRequestedAt,
      execDossierGrade,
      currentlySurfaced: execDossierGrade === 'A',
      onSprintTarget: c.weeklyBadgesEarned.length > 0,
      resumeScore: c.resumes[0]?.atsScore ?? null,
    }
  })

  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.primaryFunction.toLowerCase().includes(q) ||
        r.industry.toLowerCase().includes(q) ||
        r.geo.toLowerCase().includes(q)
    )
  }

  rows.sort((a, b) => (dir === 'asc' ? compareRows(a, b, sort) : compareRows(b, a, sort)))

  const surfacedCount = rows.filter((r) => r.currentlySurfaced).length

  const columns: AdminColumn<Row>[] = [
    { header: 'Name', sortKey: 'name', render: (r) => r.name },
    { header: 'Email', render: (r) => r.email },
    { header: 'Function', sortKey: 'function', render: (r) => r.primaryFunction },
    { header: 'Level', sortKey: 'level', render: (r) => r.level },
    { header: 'Target role', sortKey: 'targetRole', render: (r) => r.targetRoleType },
    { header: 'Industry', sortKey: 'industry', render: (r) => r.industry },
    {
      header: 'Geo',
      sortKey: 'geo',
      render: (r) => (
        <div>
          <div>{r.geo}</div>
          <div className="text-xs text-muted-foreground">{r.geoFlex}</div>
        </div>
      ),
    },
    {
      header: 'Resume Score',
      sortKey: 'resumeScore',
      render: (r) => (r.resumeScore !== null ? `${r.resumeScore}/100` : '—'),
    },
    {
      header: 'Exec Dossier Grade',
      sortKey: 'execDossierGrade',
      render: (r) =>
        r.currentlySurfaced ? (
          <span className="font-medium text-success">{r.execDossierGrade} — surfaced</span>
        ) : (
          <span className="text-muted-foreground">{r.execDossierGrade ?? 'Not graded'} — locked</span>
        ),
    },
    {
      header: 'Sprint Target',
      sortKey: 'sprintTarget',
      render: (r) =>
        r.onSprintTarget ? (
          <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-semibold text-orange">
            Sprint Target
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { header: 'Privacy tier', sortKey: 'privacyTier', render: (r) => r.privacyTier },
    {
      header: 'Requested',
      sortKey: 'requestedAt',
      className: 'px-3 py-2 font-medium tabular-nums',
      render: (r) => r.requestedAt?.toLocaleDateString() ?? '—',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiter Database</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} candidates opted in; {surfacedCount} currently surfaced to the Talent match engine.
          Opting in is necessary but not sufficient — a candidate is only actually matched to roles while
          holding an A Exec Dossier Grade. Click a column header to sort.
        </p>
      </div>

      <AdminFilterBar
        basePath="/support/admin/recruiter-database"
        searchValue={params.q ?? ''}
        searchPlaceholder="Search by name, email, function, industry, geo…"
      />

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates have opted in yet."
        sorting={{
          currentKey: sort,
          currentDir: dir,
          basePath: '/support/admin/recruiter-database',
          baseParams: q ? { q } : {},
        }}
      />
    </div>
  )
}
