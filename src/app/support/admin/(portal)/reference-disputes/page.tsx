import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReferenceDisputeRow } from '@/components/admin/ReferenceDisputeRow'

export const maxDuration = 30

export default async function ReferenceDisputesAdminPage() {
  await requireAdmin()

  const disputes = await prisma.reference.findMany({
    where: { candidateDisputedAt: { not: null }, disputeResolvedAt: null },
    orderBy: { candidateDisputedAt: 'desc' },
    include: { candidate: { select: { userId: true, firstName: true, lastName: true } } },
  })

  const admin = createAdminClient()
  const rows = await Promise.all(
    disputes.map(async (d) => {
      const { data: userData } = await admin.auth.admin.getUserById(d.candidate.userId)
      return {
        id: d.id,
        candidateName: [d.candidate.firstName, d.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
        candidateEmail: userData.user?.email ?? 'unknown',
        refereeName: d.refereeName,
        note: d.candidateDisputeNote ?? '',
        disputedAt: d.candidateDisputedAt?.toLocaleDateString() ?? '—',
      }
    })
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reference Disputes</h1>
        <p className="mt-1 text-muted-foreground">
          References a candidate has flagged as incorrect — {rows.length} awaiting review. Held
          out of that candidate&apos;s Certified Executive Dossier and Evidence Brief until resolved here.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open disputes.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <ReferenceDisputeRow key={row.id} {...row} />
          ))}
        </div>
      )}
    </div>
  )
}
