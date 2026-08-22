'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Lands on EQoverIQ's own landing page, not '/' — same brand-bleed
// avoidance as signOutCrucibleEmployer.
export async function signOutEqOverIqContributor() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/eqoveriq')
}
