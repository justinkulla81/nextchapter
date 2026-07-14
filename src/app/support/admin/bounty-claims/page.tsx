import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { BountyClaimRow } from '@/components/admin/BountyClaimRow'

export default async function BountyClaimsAdminPage() {
  await requireAdmin()

  const claims = await prisma.bountyClaim.findMany({
    include: { candidate: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const admin = createAdminClient()
  const rows = await Promise.all(
    claims.map(async (claim) => {
      const { data: userData } = await admin.auth.admin.getUserById(claim.candidate.userId)
      const { data: signedUrlData } = await admin.storage
        .from('offer-letters')
        .createSignedUrl(claim.offerLetterUrl, 60 * 10)

      return {
        id: claim.id,
        candidateName: claim.candidate.displayName || claim.candidate.firstName || 'Unknown',
        candidateEmail: userData.user?.email ?? 'unknown',
        companyName: claim.companyName,
        roleTitle: claim.roleTitle,
        startDate: claim.startDate.toLocaleDateString(),
        paymentMethod: claim.paymentMethod,
        paymentHandle: claim.paymentHandle,
        status: claim.status,
        paidAt: claim.paidAt?.toLocaleDateString() ?? null,
        signedUrl: signedUrlData?.signedUrl ?? null,
        createdAt: claim.createdAt.toLocaleDateString(),
      }
    })
  )

  const pending = rows.filter((r) => r.status === 'PENDING')
  const reviewed = rows.filter((r) => r.status !== 'PENDING')

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bounty Claims</h1>
        <p className="mt-1 text-muted-foreground">
          Review offer-letter submissions for the $500 &quot;got hired&quot; bounty.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Pending review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          pending.map((claim) => <BountyClaimRow key={claim.id} {...claim} />)
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Reviewed ({reviewed.length})</h2>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No claims reviewed yet.</p>
        ) : (
          reviewed.map((claim) => <BountyClaimRow key={claim.id} {...claim} />)
        )}
      </div>
    </div>
  )
}
