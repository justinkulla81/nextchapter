'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { recordVisitDay } from '@/lib/effort/load'

/** Records that the member opened NextChapter today. Called at most once a day per browser. */
export async function recordVisit(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const profile = await getOrCreateCandidateProfile(user.id)
  await recordVisitDay(profile.id)
}
