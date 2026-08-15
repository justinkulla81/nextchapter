import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin/auth'
import { getRoleGrants } from '@/lib/auth/role-grants'

// A logged-in user with no CandidateProfile falls through every
// candidate-flow entry point's "no profile -> create one" logic exactly
// like a brand-new signup, unless that entry point explicitly rules out
// the other portal roles first. Centralizing the check here so a future
// call site can't reintroduce the same gap that let admin/coach/recruiter
// accounts pick up a stray CandidateProfile (e.g. via a password-reset
// fallback redirect landing on /dashboard or /onboarding/resume directly).
//
// Sourced from the RoleGrant ledger (single query) instead of three
// separate EmployerProfile/Recruiter/Coach findUnique calls — same
// behavior and same call sites, just one lookup instead of four. Admin
// stays a separate email-based check (isAdminEmail), not a RoleGrant —
// nc_admin grants aren't wired to anything yet this phase.
export async function redirectIfNotCandidate(userId: string, email: string | null | undefined) {
  if (isAdminEmail(email)) {
    redirect('/support/admin')
  }

  const roles = await getRoleGrants(userId)

  if (
    roles.includes('employer_admin') ||
    roles.includes('employer_viewer') ||
    roles.includes('employer_legal') ||
    roles.includes('employer_finance')
  )
    redirect('/employer')
  if (roles.includes('recruiter')) redirect('/recruiters/dashboard')
  if (roles.includes('coach')) redirect('/support/coach')
  if (roles.includes('hiring_manager')) redirect('/hiring/dashboard')
}
