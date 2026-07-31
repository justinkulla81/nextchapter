import type { CompanySizeBand } from '@prisma/client'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { calibratedLevelRank } from '@/lib/scoring/level-rank'

// Best-effort mapping from a free-text job title (all we get from an ATS
// feed before a human ever looks at it) to the same function vocabulary
// candidates pick from in onboarding. Ordered most-specific-first so, e.g.,
// "Data Engineer" lands on Engineering rather than Data & Analytics, and a
// C-suite title lands on Executive Leadership rather than its functional
// area. Returns null when nothing matches confidently — callers should
// treat null as "don't filter on this," not "no candidates fit."
const FUNCTION_KEYWORDS: { function: (typeof PRIMARY_FUNCTION_OPTIONS)[number]; keywords: string[] }[] = [
  // Checked before the C-suite acronyms below so a support title like
  // "Executive Assistant to the CEO" lands on Administration rather than
  // matching the bare "ceo" substring.
  { function: 'Administration', keywords: ['administrative assistant', 'office manager', 'executive assistant'] },
  // The bare 3-letter acronyms (ceo/coo/cfo/cto/cmo/cpo) are handled
  // separately via EXEC_ACRONYM_PATTERN below, not as plain substrings here —
  // see that constant's comment for why (they collide with ordinary words).
  { function: 'Executive Leadership', keywords: ['chief executive', 'chief operating', 'chief financial', 'chief technology', 'chief marketing', 'chief product', 'chief people', 'chief revenue', 'chief legal', 'general manager', 'president'] },
  { function: 'Legal', keywords: ['legal', 'counsel', 'attorney', 'compliance', 'paralegal'] },
  { function: 'Human Resources', keywords: ['human resources', 'recruiter', 'recruiting', 'talent acquisition', 'people partner', 'people operations', 'hrbp'] },
  { function: 'Data & Analytics', keywords: ['data scientist', 'data analyst', 'analytics', 'business intelligence', 'bi analyst', 'machine learning engineer', 'ml engineer', 'data & ai', 'data and ai'] },
  { function: 'Engineering', keywords: ['engineer', 'developer', 'software', 'devops', 'site reliability', 'sre', 'architect', 'programmer', 'qa engineer'] },
  { function: 'Design', keywords: ['designer', 'ux', 'ui/ux', 'product design', 'creative director'] },
  { function: 'Product', keywords: ['product manager', 'product owner', 'product lead'] },
  { function: 'Marketing', keywords: ['marketing', 'growth marketer', 'brand manager', 'demand generation', 'seo specialist', 'content strategist'] },
  { function: 'Sales', keywords: ['account executive', 'business development', 'sales representative', 'sales manager', 'sdr', 'bdr', 'sales director'] },
  { function: 'Customer Success', keywords: ['customer success', 'customer support', 'client success', 'implementation manager'] },
  { function: 'Finance', keywords: ['accountant', 'accounting', 'controller', 'fp&a', 'treasury', 'financial analyst'] },
  { function: 'Operations', keywords: ['operations', 'supply chain', 'logistics'] },
]

// Single-word keywords common enough in everyday English to describe jobs
// that have nothing to do with the function they're filed under here —
// "operations" shows up in Facilities/IT/Warehouse/Fraud Operations just as
// often as the general biz-ops sense meant here (a "Facilities Operations
// Manager" is not a business-operations candidate's peer), and bare
// "president" is a substring of "vice president" at any level in any
// function, so e.g. "VP of Engineering" was misclassifying as Executive
// Leadership. Verified against ~6,750 real live ATS titles: requiring 2+
// keyword hits as a *blanket* rule wipes out ~55% of genuinely correct
// single-keyword matches (Software Engineer, Sales Director, etc.), so the
// fix is scoped to just these two known offenders — a solo hit on one of
// these needs a second corroborating keyword from the same entry (e.g.
// "supply chain manager") before counting as confident.
const AMBIGUOUS_SOLO_KEYWORDS = new Set(['operations', 'president'])

// The bare 3-letter C-suite acronyms need a word-boundary check, not a
// plain substring match — "cto" is a literal substring of "director"
// (dire-CTO-r), "contractor", "doctor", "factory", "sector", and "actor";
// "coo" is a substring of "coordinator"/"cooperate". Checked as plain
// .includes() keywords, any of those ordinary titles were silently
// misclassifying as Executive Leadership / C-Suite for every candidate,
// regardless of the candidate's own level — a live bug, not hypothetical
// (surfaced by an "Executive Director" posting reading as C-Suite here).
const EXEC_ACRONYM_PATTERN = /\b(?:ceo|coo|cfo|cto|cmo|cpo)\b/

// "Administrative Business Partner, Office of the CEO" is a support role
// that works FOR an executive, not the executive themselves — but "office
// of the ceo" contains the bare substring "ceo", so it was matching the
// Executive Leadership function and C-Suite level the same way an actual
// CEO title would. Neutralize the acronym/title inside this specific
// "office of the ___" phrasing before running the keyword scan, for both
// function and level inference.
function stripExecutiveOfficePhrase(lower: string): string {
  return lower.replace(/\boffice of the (chief \w+( \w+)?|ceo|coo|cfo|cto|cmo|cpo|president)\b/g, 'office of the executive')
}

export function inferFunctionFromTitle(title: string): string | null {
  const lower = stripExecutiveOfficePhrase(title.toLowerCase())
  for (const entry of FUNCTION_KEYWORDS) {
    const hits = entry.keywords.filter((kw) => lower.includes(kw))
    const matchesExecAcronym = entry.function === 'Executive Leadership' && EXEC_ACRONYM_PATTERN.test(lower)
    if (hits.length === 0 && !matchesExecAcronym) continue
    const weak = hits.length === 1 && !matchesExecAcronym && AMBIGUOUS_SOLO_KEYWORDS.has(hits[0])
    if (!weak) return entry.function
  }
  return null
}

// Same best-effort keyword approach, for seniority instead of function.
// Checked most-senior-first so "VP of Engineering" doesn't fall through to
// a lower band via some coincidental substring. Titles with no management
// keyword default to 'IC' rather than null — the overwhelming majority of
// unlabeled titles (engineer, analyst, specialist, representative) really
// are individual-contributor roles, and this is only ever used as a soft
// match signal, never a hard gate.
const LEVEL_KEYWORDS: { level: (typeof HIGHEST_LEVEL_OPTIONS)[number]; keywords: string[] }[] = [
  // Bare acronyms (ceo/coo/cfo/cto/cmo/cpo) handled via EXEC_ACRONYM_PATTERN
  // below, not as plain substrings here — see that constant's comment.
  { level: 'C-Suite', keywords: ['chief executive', 'chief operating', 'chief financial', 'chief technology', 'chief marketing', 'chief product', 'chief people', 'chief revenue', 'chief legal', 'president', 'partner'] },
  { level: 'VP', keywords: ['vice president', ' vp ', 'vp,', 'vp of', 'svp', 'evp'] },
  // "Head of X" is a director-equivalent title at most companies (it names
  // ownership of a whole function, not a single team) — checked before
  // Manager below so it doesn't fall through to that lower band.
  { level: 'Director', keywords: ['director', 'head of'] },
  { level: 'Manager', keywords: ['manager', 'team lead'] },
]

// "Partner" only means firm-equity seniority when it stands on its own
// ("Partner", "Managing Partner", "General Partner"). Preceded by a function
// qualifier it's an ordinary staff title: an HR Business Partner is an IC,
// and an "Administrative Business Partner" is an executive assistant.
//
// This was a live bug, not a hypothetical. The bare 'partner' C-Suite
// keyword classified that whole title family as C-Suite, and the ATS feed's
// level gate (ats-job-board-feed.ts — levelDistance <= 1) trusts this
// function, so "Business Partner Analyst" and "Administrative Business
// Partner" were being surfaced to VP/C-suite candidates as matches.
//
// Rewrites the qualifier phrase instead of dropping the word, so a title
// like "Business Partner Analyst" still infers its function normally.
const STAFF_PARTNER_QUALIFIERS = [
  'business',
  'hr',
  'human resources',
  'people',
  'talent',
  'finance',
  'financial',
  'administrative',
  'admin',
  'channel',
  'delivery',
  'implementation',
  'solutions',
  'customer',
  'account',
  'learning',
]

function neutralizeStaffPartnerPhrase(lower: string): string {
  const alternation = STAFF_PARTNER_QUALIFIERS.map((q) => q.replace(/ /g, '\\s+')).join('|')
  // One optional word may sit between the qualifier and "partner" — covers
  // "Customer Success Partner", "Talent Acquisition Partner", "People
  // Operations Partner" without needing an entry for every combination.
  // Genuine equity titles ("Managing Partner", "General Partner") don't
  // start with a staff qualifier, so they're untouched.
  return lower.replace(new RegExp(`\\b(${alternation})(\\s+\\w+)?\\s+partner\\b`, 'g'), '$1$2 specialist')
}

// Bare "ED" is corporate shorthand for Executive Director, common in some
// companies' internal title conventions (e.g. "ED, Data & AI, Enterprise").
// The spelled-out "Executive Director" already matches the plain 'director'
// substring above; this two-letter abbreviation needs its own word-boundary
// check so it doesn't collide with ordinary words ending in "...ed" (e.g.
// "Certified", "Related"). Scoped to the Director tier only, checked in the
// same most-senior-first loop below so an explicit VP/C-Suite keyword
// elsewhere in the title still wins.
const BARE_ED_ABBREVIATION = /\bed\b/

export function inferLevelFromTitle(title: string): string {
  const lower = ` ${neutralizeStaffPartnerPhrase(stripExecutiveOfficePhrase(title.toLowerCase()))} `
  for (const entry of LEVEL_KEYWORDS) {
    const matchesKeyword = entry.keywords.some((kw) => lower.includes(kw))
    const matchesExecAcronym = entry.level === 'C-Suite' && EXEC_ACRONYM_PATTERN.test(lower)
    const matchesBareED = entry.level === 'Director' && BARE_ED_ABBREVIATION.test(lower)
    if (matchesKeyword || matchesExecAcronym || matchesBareED) {
      return entry.level
    }
  }
  return 'IC'
}

// Composes the title-only heuristic above with a known company size — the
// one place job-side company size enters the level-matching path today (see
// ats-job-board-feed.ts, the only caller). See src/lib/scoring/level-rank.ts
// for the calibration math.
export function inferCalibratedLevelRank(title: string, companySizeBand: CompanySizeBand | null): number | null {
  return calibratedLevelRank(inferLevelFromTitle(title), companySizeBand)
}
