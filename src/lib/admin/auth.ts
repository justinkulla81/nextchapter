import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

// Used by candidate-flow entry points (dashboard, onboarding) to bail out
// before creating a stray CandidateProfile for an admin-only account — an
// admin has no Employer/Recruiter/Coach row either, so without this check
// they'd fall through candidate-flow logic exactly like a brand-new signup.
export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase())
}

// Pre-seed admin gate — a plain env-var allowlist checked against the
// logged-in Supabase user's email. No roles table yet; this is the whole
// admin surface today, so a full RBAC system would be premature.
export async function requireAdmin() {
  const supabase = await createClient()
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

  return user
}

// Target for research-library alerts (PR/media hooks, product-positioning
// flags) — a dedicated env var if set, otherwise the first allowlisted
// admin. No "Victoria/Dossier copy owner" role exists yet, so this is the
// practical stand-in until one does.
export function getResearchLibraryAlertEmail(): string | null {
  return process.env.RESEARCH_LIBRARY_ALERT_EMAIL ?? adminEmails()[0] ?? null
}

// Target for the daily recruiter-database digest (a summary of every
// candidate who unlocked recruiter visibility that day) — same
// dedicated-env-var-or-first-admin fallback as getResearchLibraryAlertEmail.
export function getRecruiterDigestAdminEmail(): string | null {
  return process.env.RECRUITER_DIGEST_ADMIN_EMAIL ?? adminEmails()[0] ?? null
}

// Target for real-time account-activity alerts (new candidate account
// created, resume uploaded) — same dedicated-env-var-or-first-admin
// fallback as the other admin targets above.
export function getAccountActivityAdminEmail(): string | null {
  return process.env.ACCOUNT_ACTIVITY_ADMIN_EMAIL ?? adminEmails()[0] ?? null
}
