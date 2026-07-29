// Certain postings require a specific professional license to be a
// legitimate candidate at all, regardless of how well function/level/
// location/comp otherwise line up — a law firm's "Partner" or "Attorney"
// posting should never surface as a fit to a candidate without a JD, and a
// hospital's "Attending Physician" posting should never surface to a
// candidate without an MD/DO. Every OTHER role at that same employer
// (marketing, ops, HR, business development, paralegal, nurse, etc.) stays
// open to everyone — this only gates the narrow subset of titles that
// genuinely require the license, never a whole employer or industry.

export type RequiredCredential = 'JD' | 'MD_OR_DO' | null

// Titles that unambiguously require a JD on their own — no other
// profession uses these terms this way.
const UNAMBIGUOUS_LEGAL_TITLE_KEYWORDS = [
  'attorney', 'esq.', 'esquire', 'general counsel', 'of counsel',
  'solicitor', 'barrister', 'litigation associate', 'corporate counsel',
]

// "Partner" alone is genuinely ambiguous — consulting, private equity, and
// accounting firms all use the title for a non-lawyer role. It only counts
// as a legal-practice signal when the posting text also corroborates a
// law-firm context (mirrors the "ambiguous solo keyword needs
// corroboration" pattern already used in infer-job-function.ts).
const AMBIGUOUS_LEGAL_TITLE_KEYWORDS = ['partner', 'associate attorney']
const LEGAL_CONTEXT_KEYWORDS = [
  'law firm', 'litigation', 'legal practice', 'j.d.', 'jd required',
  'juris doctor', 'licensed to practice law', 'bar admission', 'attorneys at law', 'llp',
]

const UNAMBIGUOUS_MEDICAL_TITLE_KEYWORDS = [
  'physician', 'attending physician', 'resident physician', 'hospitalist', 'surgeon', 'medical doctor',
]

export function detectRequiredCredential(postingText: string): RequiredCredential {
  const lower = postingText.toLowerCase()

  if (UNAMBIGUOUS_LEGAL_TITLE_KEYWORDS.some((kw) => lower.includes(kw))) return 'JD'
  if (
    AMBIGUOUS_LEGAL_TITLE_KEYWORDS.some((kw) => lower.includes(kw)) &&
    LEGAL_CONTEXT_KEYWORDS.some((kw) => lower.includes(kw))
  ) {
    return 'JD'
  }

  if (UNAMBIGUOUS_MEDICAL_TITLE_KEYWORDS.some((kw) => lower.includes(kw))) return 'MD_OR_DO'

  return null
}

export interface CredentialedCandidate {
  hasJD: boolean
  hasMD: boolean
  hasDO: boolean
}

export function candidateMeetsCredentialGate(candidate: CredentialedCandidate, required: RequiredCredential): boolean {
  if (!required) return true
  if (required === 'JD') return candidate.hasJD
  if (required === 'MD_OR_DO') return candidate.hasMD || candidate.hasDO
  return true
}
