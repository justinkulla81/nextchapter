// Real, confirmed production bug: extract-profile-fields.ts writes
// whatever a resume's LLM extraction reports as firstName/lastName
// directly to CandidateProfile with no plausibility check. A candidate who
// drafted a resume with an external AI tool and never replaced its
// placeholder header ("FIRST LAST", "Phone ▫ Email", "CONSULTING NAME")
// got exactly that literal text written into their real name fields —
// confirmed against two real candidates whose profiles showed "First
// Last" and whose resume text literally opened with "FIRST LAST". This is
// the single source of truth for recognizing that case, used both to
// refuse writing a placeholder into CandidateProfile.firstName/lastName
// and to flag it as a real, high-severity resume issue on the Market
// Reality side (a resume this broken needs a candidate-visible flag, not
// just a silently-blanked name field).
const PLACEHOLDER_NAMES = new Set([
  'first last',
  'firstname lastname',
  'first name last name',
  'your name',
  'full name',
  'candidate name',
  'insert name',
  'insert name here',
  'name here',
  'jane doe',
  'john doe',
])

export function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return false
  return PLACEHOLDER_NAMES.has(name.trim().toLowerCase())
}
