import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'

// Which of a member's OWN contacts at an employer is worth messaging about a job:
// the recruiter running the hiring, or the leader the role probably reports to.
// Pure — no database — so the rules are unit-tested (src/test/contact-role.test.ts).

export type ContactRole = 'recruiter' | 'hiring_manager'

const RECRUITER_TITLE =
  /\b(recruit\w*|talent acquisition|talent partner|talent lead|head of talent|sourc(er|ing)|staffing|people partner|hr business partner|human resources|\bhr\b)\b/i

// Titles that name a person who SELLS or places other people's services, not one hiring
// for their own company ("Recruiting Software Sales") — never a recruiter for a job here.
const NOT_A_RECRUITER = /\b(sales|account executive|business development|software|saas|vendor|solutions? consultant)\b/i

const SENIOR_LEVELS = new Set(['Director', 'VP', 'C-Suite'])
const IC_NOUN = /\b(engineer|developer|analyst|specialist|associate|coordinator|representative|consultant|architect|scientist|designer)\b/i
const LEADERSHIP_WORD = /\b(head|director|vp|vice president|svp|evp|chief|manager of|lead of|head of)\b/i

/**
 * Recruiter by title; hiring manager when the contact is a director-or-above in the
 * SAME function as the job (a VP of Engineering for an engineering role). Anyone else
 * is not surfaced — an unrelated acquaintance is not "who to contact about this job".
 */
export function classifyContactRole(input: { contactTitle: string | null; jobTitle: string }): ContactRole | null {
  const title = input.contactTitle?.trim()
  if (!title) return null
  if (RECRUITER_TITLE.test(title) && !NOT_A_RECRUITER.test(title)) return 'recruiter'

  // An individual-contributor title is never a hiring manager, whatever else is in it:
  // "Staff Partner Engineer" reads as senior to the level inference ("partner"), but
  // is an engineer. Only an explicit leadership word overrides an IC noun.
  if (IC_NOUN.test(title) && !LEADERSHIP_WORD.test(title)) return null
  if (!SENIOR_LEVELS.has(inferLevelFromTitle(title))) return null
  const theirs = inferFunctionFromTitle(title)
  const wanted = inferFunctionFromTitle(input.jobTitle)
  if (theirs && wanted && theirs === wanted) return 'hiring_manager'
  return null
}

/**
 * Company-level version, for ranking: is this contact of the member's a recruiter, or a
 * leader in one of the member's OWN functions (the person roles like theirs would
 * report into)? A leader in an unrelated function is not "reach" for this member.
 */
export function classifyContactForMember(input: {
  contactTitle: string | null
  memberFunctions: (string | null | undefined)[]
}): ContactRole | null {
  const title = input.contactTitle?.trim()
  if (!title) return null
  if (RECRUITER_TITLE.test(title) && !NOT_A_RECRUITER.test(title)) return 'recruiter'
  if (IC_NOUN.test(title) && !LEADERSHIP_WORD.test(title)) return null
  if (!SENIOR_LEVELS.has(inferLevelFromTitle(title))) return null
  const theirs = inferFunctionFromTitle(title)
  const mine = new Set(input.memberFunctions.filter((f): f is string => !!f))
  return theirs && mine.has(theirs) ? 'hiring_manager' : null
}
