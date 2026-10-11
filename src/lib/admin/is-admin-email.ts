// The ADMIN_EMAILS allowlist, split out of auth.ts so code that can't
// import next/navigation (scripts, the Higher Ed resolver) can check it too.

export function adminEmails(): string[] {
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
