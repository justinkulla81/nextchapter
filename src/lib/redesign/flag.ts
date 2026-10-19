// The redesigned candidate site (docs/candidate-redesign.md) is switched on in two ways, so it can be
// checked on real data before everyone sees it:
//   CANDIDATE_REDESIGN=on             everyone
//   CANDIDATE_REDESIGN_EMAILS=a@b.c   a comma-separated list of members who see it
// Anything else leaves the live site as it is. Pure, so tests and server components share it.

// Always on for the owner's own sign-in, so the new site can be checked without touching deployment settings.
const OWNER_EMAILS = ['justin.kulla@gmail.com']

export function isRedesignOn(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if ((env.CANDIDATE_REDESIGN ?? '').trim().toLowerCase() === 'on') return true
  if (!email) return false
  const allow = [...OWNER_EMAILS, ...(env.CANDIDATE_REDESIGN_EMAILS ?? '').split(',')].map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allow.includes(email.trim().toLowerCase())
}
