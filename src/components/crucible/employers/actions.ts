'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// A shared sign-out redirecting to '/' (src/app/dashboard/actions.ts)
// exists, but sends an NEN employer back to the main NextChapter homepage —
// exactly the brand-bleed this portal is built to avoid. This lands on
// NEN's own landing page instead.
export async function signOutCrucibleEmployer() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/noexperience')
}
