import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'

export const maxDuration = 30

interface Row {
  id: string
  name: string
  email: string
  primaryFunction: string
  level: string
  targetRoleType: string
  privacyTier: string
  requestedAt: string
  searchActionGrade: string | null
  currentlySurfaced: boolean
}

export default async function RecruiterDatabaseAdminPage() {
  await requireAdmin()

  const [candidates, authUsers] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { recruiterDatabaseOptIn: true },
      orderBy: { recruiterDatabaseRequestedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        primaryFunction: true,
        highestLevelReached: true,
        targetRoleType: true,
        privacyTier: true,
        recruiterDatabaseRequestedAt: true,
        hireabilityReports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { hireabilityGradeAtGeneration: true },
        },
      },
    }),
    listAllAuthUsers(),
  ])

  const rows: Row[] = candidates.map((c) => {
    const grade = normalizeGradeSnapshot(c.hireabilityReports[0]?.hireabilityGradeAtGeneration)
    const searchActionGrade = grade?.grade ?? null
    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
      email: getAuthEmail(authUsers, c.userId),
      primaryFunction: c.primaryFunction ?? '—',
      level: c.highestLevelReached ?? '—',
      targetRoleType: c.targetRoleType ?? '—',
      privacyTier: c.privacyTier,
      requestedAt: c.recruiterDatabaseRequestedAt?.toLocaleDateString() ?? '—',
      searchActionGrade,
      currentlySurfaced: searchActionGrade === 'A',
    }
  })
  const surfacedCount = rows.filter((r) => r.currentlySurfaced).length

  const columns: AdminColumn<Row>[] = [
    { header: 'Name', render: (r) => r.name },
    { header: 'Email', render: (r) => r.email },
    { header: 'Function', render: (r) => r.primaryFunction },
    { header: 'Level', render: (r) => r.level },
    { header: 'Target role', render: (r) => r.targetRoleType },
    { header: 'Privacy tier', render: (r) => r.privacyTier },
    {
      header: 'Market Reality Grade',
      render: (r) =>
        r.currentlySurfaced ? (
          <span className="font-medium text-success">{r.searchActionGrade} — surfaced</span>
        ) : (
          <span className="text-muted-foreground">{r.searchActionGrade ?? 'Not graded'} — locked</span>
        ),
    },
    { header: 'Requested', className: 'px-3 py-2 font-medium tabular-nums', render: (r) => r.requestedAt },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruiter Database</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} candidates opted in; {surfacedCount} currently surfaced to the Talent match engine.
          Opting in is necessary but not sufficient — a candidate is only actually matched to roles while
          holding an A Market Reality Grade.
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No candidates have opted in yet."
      />
    </div>
  )
}
