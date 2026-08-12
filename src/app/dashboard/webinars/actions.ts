'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { registerForWebinar } from '@/lib/webinars/webinars'

async function getAuthedProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getOrCreateCandidateProfile(user.id)
}

export async function registerForWebinarAction(webinarId: string) {
  const profile = await getAuthedProfile()
  if (!profile) return
  await registerForWebinar(webinarId, profile.id)
  revalidatePath('/dashboard/webinars')
}
