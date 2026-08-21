'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { RoleGrantRole } from '@prisma/client'

// Login destination for each role this app has a real portal for today.
// Roles with no entry here (alum, member) have no switchable portal yet —
// RoleContextBanner filters them out rather than rendering a dead link.
// employer_admin/employer_viewer/employer_legal/employer_finance added in
// Phase 5 (§A7's employer portal) — all four land on the same
// /employer/login, which resolves the actual role/org server-side via
// getCurrentOutplacementOrgUser. hiring_manager added in Phase 7 (§A8's
// hiring-manager portal).
const PORTAL_LOGIN_PATH: Partial<Record<RoleGrantRole, string>> = {
  candidate: '/auth/login',
  coach: '/support/coach/login',
  recruiter: '/recruiters/login',
  nc_admin: '/support/admin/login',
  employer_admin: '/employer/login',
  employer_viewer: '/employer/login',
  employer_legal: '/employer/login',
  employer_finance: '/employer/login',
  // Phase 7, §A8's hiring-manager portal.
  hiring_manager: '/hiring/login',
  // NEN's own employer portal — a separate profile/table from
  // employer_admin (which is /talent's), see CrucibleEmployerProfile.
  nen_employer: '/crucible/employers/login',
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
