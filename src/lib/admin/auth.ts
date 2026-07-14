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
