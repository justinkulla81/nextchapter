import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HireabilityGrade } from '@/lib/scoring/grade'

export const maxDuration = 30

export default async function RecruiterDatabaseAdminPage() {
  await requireAdmin()

  const candidates = await prisma.candidateProfile.findMany({
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
  })

  const admin = createAdminClient()
  const rows = await Promise.all(
    candidates.map(async (c) => {
      const { data: userData } = await admin.auth.admin.getUserById(c.userId)
      const grade = c.hireabilityReports[0]?.hireabilityGradeAtGeneration as unknown as HireabilityGrade | undefined
      const searchActionGrade = grade?.grade ?? null
      return {
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
        email: userData.user?.email ?? 'unknown',
        primaryFunction: c.primaryFunction ?? '—',
        level: c.highestLevelReached ?? '—',
        targetRoleType: c.targetRoleType ?? '—',
        privacyTier: c.privacyTier,
        requestedAt: c.recruiterDatabaseRequestedAt?.toLocaleDateString() ?? '—',
        searchActionGrade,
        currentlySurfaced: searchActionGrade === 'A',
      }
    })
  )
  const surfacedCount = rows.filter((r) => r.currentlySurfaced).length

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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Function</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Target role</th>
              <th className="px-3 py-2 font-medium">Privacy tier</th>
              <th className="px-3 py-2 font-medium">Market Reality Grade</th>
              <th className="px-3 py-2 font-medium">Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.primaryFunction}</td>
                <td className="px-3 py-2">{r.level}</td>
                <td className="px-3 py-2">{r.targetRoleType}</td>
                <td className="px-3 py-2">{r.privacyTier}</td>
                <td className="px-3 py-2">
                  {r.currentlySurfaced ? (
                    <span className="font-medium text-success">{r.searchActionGrade} — surfaced</span>
                  ) : (
                    <span className="text-muted-foreground">{r.searchActionGrade ?? 'Not graded'} — locked</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.requestedAt}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No candidates have opted in yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
