'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Sign out of the org portal only (the candidate session, if any, stays).
export async function signOutOrg(next: string) {
  const supabase = await createClient('org')
  await supabase.auth.signOut()
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/')
}
