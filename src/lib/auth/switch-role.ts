'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PortalKey } from '@/lib/supabase/portal'
import type { RoleGrantRole } from '@prisma/client'

// Maps a held role to the portal whose session should be read when
// switching AWAY from it — deliberately separate from PORTAL_LOGIN_PATH
// below (that one maps the TARGET role to a login path; this maps the
// CURRENT role to a session). candidate has no entry — it's the one role
// that stays on the default/unscoped cookie.
const ROLE_TO_PORTAL: Partial<Record<RoleGrantRole, PortalKey>> = {
  coach: 'coach',
  recruiter: 'recruiter',
  nc_admin: 'admin',
  employer_admin: 'employer',
  employer_viewer: 'employer',
  employer_legal: 'employer',
  employer_finance: 'employer',
  hiring_manager: 'hiring',
  nen_employer: 'nen',
  eqoveriq_contributor: 'eqoveriq',
}

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
  nen_employer: '/noexperience/employers/login',
  // EQoverIQ's own contributor portal — same standalone-product pattern.
  eqoveriq_contributor: '/eqoveriq/contributors/login',
}

// Re-auth on switch — Partners Master Build Script §A1.2.1: "Separate
// authenticated sessions. Logging into the org portal does not log you
// into the candidate portal. Explicit switch, re-auth, persistent context
// banner." Every non-candidate portal now has its own session cookie (see
// src/lib/supabase/portal.ts), so unlike the old shared-session world,
// switching does NOT sign out of the current portal — there's no shared
// session left to sign out of, and doing so would needlessly kill a still
// -valid session in the portal being switched away from. The target
// portal's cookie simply doesn't exist yet in this browser, so its own
// login page naturally requires a real credential check. Pre-filling the
// email (LoginForm already reads `?email=`) is what makes this feel like
// "switching" instead of a bare "log in as someone else."
export async function switchRole(targetRole: RoleGrantRole, currentRole: RoleGrantRole): Promise<void> {
  const loginPath = PORTAL_LOGIN_PATH[targetRole]
  if (!loginPath) redirect('/')

  const supabase = await createClient(ROLE_TO_PORTAL[currentRole])
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email

  redirect(email ? `${loginPath}?email=${encodeURIComponent(email)}&switched=1` : `${loginPath}?switched=1`)
}
