'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { GOOGLE_DATA_CONFIRM_WORD } from '@/lib/google/google-data-confirm'
import { deleteGoogleDataForCandidate, type GoogleDataDeletionResult } from '@/lib/google/delete-google-data'

export type DeleteGoogleDataState =
  | { ok: true; result: GoogleDataDeletionResult }
  | { ok: false; error: string }
  | undefined

export async function deleteMyGoogleData(_prev: DeleteGoogleDataState, formData: FormData): Promise<DeleteGoogleDataState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your session ended. Log in again, then try once more.' }

  const typed = String(formData.get('confirmation') ?? '').trim().toUpperCase()
  if (typed !== GOOGLE_DATA_CONFIRM_WORD) {
    return { ok: false, error: `Type ${GOOGLE_DATA_CONFIRM_WORD} in the box to confirm. Nothing was deleted.` }
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  try {
    const result = await deleteGoogleDataForCandidate(profile.id)
    captureServerEvent(profile.id, 'google_data_deleted', { ...result })
    for (const p of ['/dashboard/privacy', '/dashboard/network', '/dashboard/find-my-job', '/dashboard/scam-watch', '/dashboard/learning']) revalidatePath(p)
    return { ok: true, result }
  } catch (error) {
    console.error('Delete my Google data failed:', error)
    captureServerEvent(profile.id, 'google_data_delete_failed', { message: error instanceof Error ? error.message.slice(0, 200) : 'unknown' })
    return { ok: false, error: 'Something went wrong and not everything was deleted. Try again in a minute, or email support@launchyournextchapter.com and we will finish it for you.' }
  }
}
