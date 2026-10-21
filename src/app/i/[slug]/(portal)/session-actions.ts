'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/safe-next'

// Sign out of the org portal only (the candidate session, if any, stays).
export async function signOutOrg(next: string) {
  const supabase = await createClient('org')
  await supabase.auth.signOut()
  redirect(safeNext(next, '/'))
}
