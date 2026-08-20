import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { ScholarshipApplicationRow } from '@/components/admin/ScholarshipApplicationRow'

export default async function ScholarshipApplicationsAdminPage() {
  await requireAdmin()

  const applications = await prisma.scholarshipApplication.findMany({
    include: { candidate: { select: { displayName: true, firstName: true, email: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const rows = applications.map((a) => ({
    id: a.id,
    candidateName: a.candidate.displayName || a.candidate.firstName || 'Unknown',
    candidateEmail: a.candidate.email ?? 'unknown',
    tier: a.tier,
    story: a.story,
    status: a.status,
    decisionNote: a.decisionNote,
    createdAt: a.createdAt.toLocaleDateString(),
  }))

  const pending = rows.filter((r) => r.status === 'PENDING')
  const reviewed = rows.filter((r) => r.status !== 'PENDING')

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scholarship Applications</h1>
        <p className="mt-1 text-muted-foreground">
          Review candidate applications for reduced or free access to a membership plan. Every application
          requires a human decision — nothing here approves automatically.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Pending review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          pending.map((application) => <ScholarshipApplicationRow key={application.id} {...application} />)
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Reviewed ({reviewed.length})</h2>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications reviewed yet.</p>
        ) : (
          reviewed.map((application) => <ScholarshipApplicationRow key={application.id} {...application} />)
        )}
      </div>
    </div>
  )
}
