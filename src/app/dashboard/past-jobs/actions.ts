'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { saveJobReview, saveParallelPaths } from '@/lib/job-reviews/data'

// Past-job reviews and parallel paths. Structured answers only — no free text, so no
// moderation call and no metered cost.

async function getProfileId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return (await getOrCreateCandidateProfile(user.id)).id
}

export type PastJobsSaveResult =
  | { ok: true; answered: number; edited: boolean; companyId: string | null }
  | { ok: false; error: string }

export async function submitJobReview(workHistoryId: string, rawReview: unknown): Promise<PastJobsSaveResult> {
  const candidateId = await getProfileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again, then save your answers.' }
  const result = await saveJobReview(candidateId, workHistoryId, rawReview)
  if (!result.ok) return result
  revalidatePath('/dashboard/past-jobs')
  revalidatePath('/dashboard/recruiter-report')
  return result
}

export type ParallelPathsResult = { ok: true; paths: string[] } | { ok: false; error: string }

export async function submitParallelPaths(rawPaths: unknown): Promise<ParallelPathsResult> {
  const candidateId = await getProfileId()
  if (!candidateId) return { ok: false, error: 'Your session ended. Sign in again, then save your answers.' }
  const paths = await saveParallelPaths(candidateId, rawPaths)
  revalidatePath('/dashboard/past-jobs')
  return { ok: true, paths }
}
