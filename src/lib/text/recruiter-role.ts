// Shared by email and calendar tracking. Recruiters — internal, agency, or
// executive/retained search — describe themselves with a fairly small set
// of job-title phrases, whether that's a LinkedIn intro, an email
// signature, or a meeting invite ("Interview w/ Jane Doe, Talent Acquisition
// Partner"). Matching on the role/title itself catches contact that plain
// phrase-matching on "I'm a recruiter" misses, in either direction.
const RECRUITER_ROLE_PATTERNS = [
  /\brecruiter\b/i,
  /\brecruiting\b/i,
  /\brecruitment\b/i,
  /\bexecutive search\b/i,
  /\bretained search\b/i,
  /\bcontingency search\b/i,
  /\bsearch consultant\b/i,
  /\bsearch partner\b/i,
  /\bsearch firm\b/i,
  /\btalent acquisition\b/i,
  /\btalent sourcer\b/i,
  /\btalent partner\b/i,
  /\btalent scout\b/i,
  /\bsourcing specialist\b/i,
  /\bheadhunter\b/i,
  /\bstaffing (?:agency|firm|consultant)\b/i,
]

export function matchRecruiterRoleMention(text: string): boolean {
  return RECRUITER_ROLE_PATTERNS.some((p) => p.test(text))
}
