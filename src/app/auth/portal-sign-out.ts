'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PortalKey } from '@/lib/supabase/portal'
import { captureServerEvent } from '@/lib/posthog/server'

// Each partner portal keeps its own session cookie, so "Sign out" there must end that
// portal's session (the shared signOut in dashboard/actions ends the candidate one).
async function signOutOf(portal: PortalKey, loginPath: string) {
  const supabase = await createClient(portal)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.auth.signOut()
  if (user) captureServerEvent(user.id, 'portal_signed_out', { portal })
  redirect(loginPath)
}

export async function signOutEmployer() {
  await signOutOf('employer', '/employer/login')
}
export async function signOutHiring() {
  await signOutOf('talent', '/talent/login')
}
export async function signOutRecruiter() {
  await signOutOf('recruiter', '/recruiters/login')
}
export async function signOutCoach() {
  await signOutOf('coach', '/support/coach/login')
}
