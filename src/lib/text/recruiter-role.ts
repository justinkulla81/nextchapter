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

// Deliberately the literal phrase only — an interview-loop calendar invite
// or confirmation email routinely names this role explicitly ("Interview
// w/ Jane Doe, Hiring Manager"), but the underlying job titles are too
// varied (any VP/director/manager could be one) to pattern-match without
// wildly overmatching unrelated meetings.
const HIRING_MANAGER_ROLE_PATTERNS = [/\bhiring manager\b/i]

export function matchHiringManagerRoleMention(text: string): boolean {
  return HIRING_MANAGER_ROLE_PATTERNS.some((p) => p.test(text))
}

// "Coach" alone is too generic (sports, a coworker's title, unrelated
// noise) to match bare — every pattern here pairs it with a search/career
// qualifier so this only fires for someone actually coaching the
// candidate's job search, not an unrelated mention.
const COACH_ROLE_PATTERNS = [
  /\bcareer coach\b/i,
  /\bexecutive coach\b/i,
  /\bleadership coach\b/i,
  /\bjob (?:search )?coach\b/i,
  /\binterview coach\b/i,
  /\bresume coach\b/i,
]

export function matchCoachRoleMention(text: string): boolean {
  return COACH_ROLE_PATTERNS.some((p) => p.test(text))
}
