'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { SITE_URL } from '@/lib/org-claims/urls'
import { approveOrgClaim, declineOrgClaim } from '@/lib/org-claims/approval'

export type ClaimDecisionState = { ok: boolean; message: string } | undefined

export async function approveClaimAction(claimId: string, _prev: ClaimDecisionState): Promise<ClaimDecisionState> {
  const admin = await requireAdmin()
  const r = await approveOrgClaim(claimId, admin.email ?? 'admin')
  if (!r.ok) return { ok: false, message: r.error }
  revalidatePath('/support/admin/organizations/claims')
  return { ok: true, message: r.slug ? `Approved. The workspace is open at ${SITE_URL}/i/${r.slug} and the claimant was emailed a sign-in link.` : 'Approved. The claimant was emailed what to do next.' }
}

export async function declineClaimAction(claimId: string, _prev: ClaimDecisionState): Promise<ClaimDecisionState> {
  const admin = await requireAdmin()
  const r = await declineOrgClaim(claimId, admin.email ?? 'admin')
  if (!r.ok) return { ok: false, message: r.error }
  revalidatePath('/support/admin/organizations/claims')
  return { ok: true, message: 'Declined. Nothing was created; they stay in the CRM as a lead.' }
}
