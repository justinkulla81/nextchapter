/**
 * How a recruiter makes money, read from what they say about themselves. The one that matters most to NextChapter is
 * candidate representation (also called reverse recruiting or candidate marketing): the recruiter works for the
 * candidate, takes a candidate to many employers, and so has a book of candidates to manage, which is exactly what
 * the candidate CRM is for. Pure: no database.
 */
export type RecruiterModel = 'candidate_rep' | 'retained_search' | 'contingent' | 'in_house'

export const MODEL_LABEL: Record<RecruiterModel, string> = {
  candidate_rep: 'Represents candidates', retained_search: 'Retained search', contingent: 'Contingent / staffing', in_house: 'In-house',
}
export const MODELS = Object.keys(MODEL_LABEL) as RecruiterModel[]

/** Phrases that say the person or firm works for the candidate. Deliberately narrow: "we place candidates" is every recruiter. */
const CANDIDATE_REP: RegExp[] = [
  /\breverse[- ]recruit\w*/i,
  /\bcandidate[- ](representation|marketing|advocacy|agent)\b/i,
  /\b(we|i)\s+(represent|market)\s+(the\s+)?(candidates?|executives?|professionals?|talent|job ?seekers?|you)\b/i,
  /\b(represent(s|ing)?|market(s|ing)?)\s+(our\s+|my\s+|his\s+|her\s+)?(candidates?|executives?|job ?seekers?)\s+(to|with|in front of)\s+(employers?|companies|hiring)/i,
  /\b(career|executive|talent|job)\s+(agent|agency|representation|advocate|concierge)\b/i,
  /\bwe work for (the )?(candidate|job ?seeker|you)\b/i,
  /\b(I am|I'm|we are|we're)\s+representing\b/i,
  /\bcandidates?\s+I\s+represent\b/i,
  /\bpaid by (the )?(candidate|job ?seeker)\b/i,
  /\bcandidate[- ]paid\b/i,
]
const RETAINED: RegExp[] = [/\bretained\b/i, /\bexecutive search\b/i, /\bsearch (firm|consultant|partner)\b/i, /\bboard (search|placement)\b/i]
const CONTINGENT: RegExp[] = [/\bcontingen\w*/i, /\bstaffing\b/i, /\bplacement agency\b/i, /\bcontract[- ]to[- ]hire\b/i]
const IN_HOUSE: RegExp[] = [/\btalent acquisition\b/i, /\bin[- ]house recruit\w*/i]

export interface ModelRead {
  models: RecruiterModel[]
  /** The phrase that showed candidate representation, for the CRM to display; null when it did not. */
  evidence: string | null
}

export function readRecruiterModels(text: string | null | undefined): ModelRead {
  const t = text ?? ''
  if (!t.trim()) return { models: [], evidence: null }
  const models: RecruiterModel[] = []
  let evidence: string | null = null
  for (const re of CANDIDATE_REP) {
    const m = t.match(re)
    if (m) { models.push('candidate_rep'); evidence = m[0].slice(0, 120); break }
  }
  if (RETAINED.some((re) => re.test(t))) models.push('retained_search')
  if (CONTINGENT.some((re) => re.test(t))) models.push('contingent')
  if (IN_HOUSE.some((re) => re.test(t))) models.push('in_house')
  return { models, evidence }
}
