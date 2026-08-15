'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { requestReassignment } from '@/lib/coach/reassignment'

export type CandidateReassignmentFormState = { error?: string; success?: boolean } | undefined

// §A5.4 one-tap reassignment request, candidate side — same no-blame queue
// as the coach-side request (requestClientReassignment), just the other
// requester. Always PENDING for admin to route; never reassigns on its own.
export async function requestCandidateReassignment(
  _prevState: CandidateReassignmentFormState,
  formData: FormData
): Promise<CandidateReassignmentFormState> {
  const profile = await getDashboardData()
  if (!profile.coachId) return { error: "You don't have a coach connected yet." }

  const reason = (formData.get('reason') as string | null)?.trim() || null

  await requestReassignment({
    candidateId: profile.id,
    requestedBy: 'CANDIDATE',
    fromCoachId: profile.coachId,
    reason,
  })

  revalidatePath('/dashboard/coach-dossier')
  return { success: true }
}
