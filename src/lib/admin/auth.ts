import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { adminEmails, isAdminEmail } from './is-admin-email'
import { aalOf, adminMfaRedirect, adminMfaSatisfied, type Aal } from './mfa'

// Where every admin-bound notification (digests, alerts, Meeting Prep) lands.
export const ADMIN_NOTIFICATION_EMAIL = 'justin@launchyournextchapter.com'

export { isAdminEmail }

// Pre-seed admin gate — a plain env-var allowlist checked against the
// logged-in Supabase user's email. No roles table yet; this is the whole
// admin surface today, so a full RBAC system would be premature.
//
// requireAdminSession: signed in on the admin portal with an allowlisted
// email, at any assurance level. Only the two-step login page itself uses it.
export const requireAdminSession = cache(async function requireAdminSession(): Promise<{ user: User; aal: Aal | null }> {
  const supabase = await createClient('admin')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Distinguish "not logged in at all" (send to the admin-specific login,
  // not the candidate one) from "logged in but not an admin" (send them to
  // wherever their own account actually belongs).
  if (!user) {
    redirect('/support/admin/login')
  }

  const email = user.email?.toLowerCase()
  if (!email || !adminEmails().includes(email)) {
    redirect('/dashboard')
  }

  // getUser() above validated (and if needed refreshed) this session, so the
  // claims read here belong to the same, current token.
  const { data } = await supabase.auth.getClaims()
  return { user, aal: aalOf(data?.claims) }
})

// The gate for every admin page, server action and API route. With
// ADMIN_MFA_REQUIRED on, an aal1 session goes to the two-step login page and
// comes back to the page it asked for (src/lib/admin/mfa.ts).
// cache(): the admin layout and the page under it both call this; it was two Supabase Auth
// round trips per navigation.
export const requireAdmin = cache(async function requireAdmin() {
  const { user, aal } = await requireAdminSession()
  if (!adminMfaSatisfied(aal)) {
    const h = await headers()
    redirect(adminMfaRedirect(h.get('x-pathname'), h.get('x-search')))
  }
  return user
})

// Target for research-library alerts (PR/media hooks, product-positioning
// flags) — a dedicated env var if set, otherwise the first allowlisted
// admin. No "Victoria/Dossier copy owner" role exists yet, so this is the
// practical stand-in until one does.
export function getResearchLibraryAlertEmail(): string | null {
  return process.env.RESEARCH_LIBRARY_ALERT_EMAIL ?? ADMIN_NOTIFICATION_EMAIL
}

// Target for the daily recruiter-database digest (a summary of every
// candidate who unlocked recruiter visibility that day) — same
// dedicated-env-var-or-first-admin fallback as getResearchLibraryAlertEmail.
export function getRecruiterDigestAdminEmail(): string | null {
  return process.env.RECRUITER_DIGEST_ADMIN_EMAIL ?? ADMIN_NOTIFICATION_EMAIL
}

// Target for real-time account-activity alerts (new candidate account
// created, resume uploaded) — same dedicated-env-var-or-first-admin
// fallback as the other admin targets above.
export function getAccountActivityAdminEmail(): string | null {
  return process.env.ACCOUNT_ACTIVITY_ADMIN_EMAIL ?? ADMIN_NOTIFICATION_EMAIL
}
