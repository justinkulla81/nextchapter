// Admin two-step login (CASA 3.3.1, ASVS 4.3.1): Supabase TOTP MFA. With
// ADMIN_MFA_REQUIRED on, every admin page, admin server action and admin API
// route (all of them go through requireAdmin) needs a session at assurance
// level aal2, meaning a password sign-in followed by an authenticator-app code.
// The same rule covers NextChapter-admin powers in the college/workforce
// portals and the systems pages (isNcAdmin in src/lib/higher-ed/resolve.ts).
//
// Off by default so it can't lock anyone out on deploy: an admin enrolls first
// at https://admin.launchyournextchapter.com/support/admin/mfa, then the flag is
// turned on. Lost phone (break glass): in the Supabase dashboard, Authentication →
// Users → the admin → remove the MFA factor, or set ADMIN_MFA_REQUIRED=false in
// Vercel and redeploy; then sign in and enroll again.

import { safeNext } from '@/lib/auth/safe-next'

export type Aal = 'aal1' | 'aal2'

export function adminMfaRequired(): boolean {
  return ['1', 'true', 'on', 'yes'].includes((process.env.ADMIN_MFA_REQUIRED ?? '').trim().toLowerCase())
}

/** The assurance level a verified JWT claims carry, or null when absent or unknown. */
export function aalOf(claims: { aal?: unknown } | null | undefined): Aal | null {
  const aal = claims?.aal
  return aal === 'aal1' || aal === 'aal2' ? aal : null
}

/** True when this session may use admin powers: always with the flag off, only at aal2 with it on. */
export function adminMfaSatisfied(aal: Aal | null): boolean {
  return !adminMfaRequired() || aal === 'aal2'
}

export const ADMIN_MFA_PATH = '/support/admin/mfa'
export const ORG_MFA_PATH = '/i/mfa'

/** Where requireAdmin sends an aal1 admin, carrying the page they wanted. */
export function adminMfaRedirect(path: string | null | undefined, search?: string | null): string {
  const next = safeNext(path ? `${path}${search ?? ''}` : null, '/support/admin')
  // Never loop back into the MFA page itself.
  const target = next.startsWith(ADMIN_MFA_PATH) ? '/support/admin' : next
  return `${ADMIN_MFA_PATH}?next=${encodeURIComponent(target)}`
}
