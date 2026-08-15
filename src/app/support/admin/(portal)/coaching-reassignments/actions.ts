'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { completeReassignment, declineReassignment } from '@/lib/coach/reassignment'
import { triggerSurgeOutreach } from '@/lib/coach/surge'

export type RouteRequestFormState = { error?: string } | undefined

// §A5.4 "one-tap reassignment request from either side, no blame, admin
// routes" — this is the routing step: admin picks the receiving coach, and
// completeReassignment does the actual coachId change + handoff-summary
// snapshot.
export async function routeReassignmentRequest(
  requestId: string,
  _prevState: RouteRequestFormState,
  formData: FormData
): Promise<RouteRequestFormState> {
  const admin = await requireAdmin()

  const toCoachId = formData.get('toCoachId') as string | null
  if (!toCoachId) return { error: 'Choose a coach to route this request to.' }

  await completeReassignment(requestId, toCoachId, admin?.email ?? 'admin')

  revalidatePath('/support/admin/coaching-reassignments')
}

export async function declineReassignmentRequest(requestId: string): Promise<void> {
  const admin = await requireAdmin()
  await declineReassignment(requestId, admin?.email ?? 'admin', null)
  revalidatePath('/support/admin/coaching-reassignments')
}

export type SurgeOutreachFormState = { error?: string; success?: boolean } | undefined

export async function triggerSurgeOutreachAction(
  _prevState: SurgeOutreachFormState,
  formData: FormData
): Promise<SurgeOutreachFormState> {
  const admin = await requireAdmin()
  const note = (formData.get('note') as string | null)?.trim() || null

  const event = await triggerSurgeOutreach(admin?.email ?? 'admin', note)
  if (event.notifiedCoachIds.length === 0 && event.benchCoachCount > 0) {
    return { error: 'No emails could be sent — check RESEND_API_KEY. Bench coaches were still recorded.' }
  }

  revalidatePath('/support/admin/coaching-reassignments')
  return { success: true }
}
