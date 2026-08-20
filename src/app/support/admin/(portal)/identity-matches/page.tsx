import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { IdentityMatchRow } from '@/components/admin/IdentityMatchRow'

export default async function IdentityMatchesAdminPage() {
  await requireAdmin()

  const matches = await prisma.candidateIdentityMatch.findMany({
    include: { candidate: { select: { displayName: true, firstName: true, lastName: true, email: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const rows = matches.map((m) => ({
    id: m.id,
    candidateName: m.candidate.displayName || [m.candidate.firstName, m.candidate.lastName].filter(Boolean).join(' ') || 'Unknown',
    candidateEmail: m.candidate.email ?? 'unknown',
    source: m.source,
    strength: m.strength,
    matchedName: m.matchedName,
    matchedEmail: m.matchedEmail,
    matchedCompany: m.matchedCompany,
    status: m.status,
    createdAt: m.createdAt.toLocaleDateString(),
  }))

  const pending = rows.filter((r) => r.status === 'PENDING')
  const reviewed = rows.filter((r) => r.status !== 'PENDING')

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Identity Matches</h1>
        <p className="mt-1 text-muted-foreground">
          A newly-registered candidate who may already exist elsewhere as a reference, a coach/recruiter
          invite lead, or someone else&apos;s outreach contact. Confirming links the two records — nothing
          links automatically, even on an exact email match.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Pending review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          pending.map((match) => <IdentityMatchRow key={match.id} {...match} />)
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Reviewed ({reviewed.length})</h2>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches reviewed yet.</p>
        ) : (
          reviewed.map((match) => <IdentityMatchRow key={match.id} {...match} />)
        )}
      </div>
    </div>
  )
}
