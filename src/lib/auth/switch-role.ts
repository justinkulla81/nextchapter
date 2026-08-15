'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { RoleGrantRole } from '@prisma/client'

// Login destination for each role this app has a real portal for today.
// Roles with no entry here (alum, member, hiring_manager, employer_admin,
// employer_viewer) have no switchable portal yet — RoleContextBanner
// filters them out rather than rendering a dead link.
const PORTAL_LOGIN_PATH: Partial<Record<RoleGrantRole, string>> = {
  candidate: '/auth/login',
  coach: '/support/coach/login',
  recruiter: '/recruiters/login',
  nc_admin: '/support/admin/login',
}

// Re-auth on switch, not a same-session navigation — Partners Master Build
// Script §A1.2.1: "Separate authenticated sessions. Logging into the org
// portal does not log you into the candidate portal. Explicit switch,
// re-auth, persistent context banner." This app currently uses ONE shared
// Supabase session cookie across every portal (see
// redirect-if-authenticated.ts's own comment on this), so simply
// navigating to another portal's dashboard would ride the SAME
// authenticated session straight across a role boundary — exactly the gap
// the spec calls out.
//
// The fix: sign out of the current session entirely, then send the user to
// the target portal's own login page. Pre-filling the email (LoginForm
// already reads `?email=`) is what makes this feel like "switching"
// instead of a bare logout — the actual security property is the
// signOut() call forcing a fresh credential check for the new portal, not
// the UI framing around it.
export async function switchRole(targetRole: RoleGrantRole): Promise<void> {
  const loginPath = PORTAL_LOGIN_PATH[targetRole]
  if (!loginPath) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email

  await supabase.auth.signOut()

  redirect(email ? `${loginPath}?email=${encodeURIComponent(email)}&switched=1` : `${loginPath}?switched=1`)
}
