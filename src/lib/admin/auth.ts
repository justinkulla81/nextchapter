import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

// Pre-seed admin gate — a plain env-var allowlist checked against the
// logged-in Supabase user's email. No roles table yet; this is the whole
// admin surface today, so a full RBAC system would be premature.
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const email = user?.email?.toLowerCase()
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
