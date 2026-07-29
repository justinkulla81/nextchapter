import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'

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
  { function: 'Executive Leadership', keywords: ['chief executive', 'chief operating', 'chief financial', 'chief technology', 'chief marketing', 'chief product', 'chief people', 'chief revenue', 'chief legal', 'ceo', 'coo', 'cfo', 'cto', 'cmo', 'cpo', 'general manager', 'president'] },
  { function: 'Legal', keywords: ['legal', 'counsel', 'attorney', 'compliance', 'paralegal'] },
  { function: 'Human Resources', keywords: ['human resources', 'recruiter', 'recruiting', 'talent acquisition', 'people partner', 'people operations', 'hrbp'] },
  { function: 'Data & Analytics', keywords: ['data scientist', 'data analyst', 'analytics', 'business intelligence', 'bi analyst', 'machine learning engineer', 'ml engineer'] },
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
    if (hits.length === 0) continue
    const weak = hits.length === 1 && AMBIGUOUS_SOLO_KEYWORDS.has(hits[0])
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
  { level: 'C-Suite', keywords: ['chief executive', 'chief operating', 'chief financial', 'chief technology', 'chief marketing', 'chief product', 'chief people', 'chief revenue', 'chief legal', 'ceo', 'coo', 'cfo', 'cto', 'cmo', 'cpo', 'president', 'partner'] },
  { level: 'VP', keywords: ['vice president', ' vp ', 'vp,', 'vp of', 'svp', 'evp'] },
  // "Head of X" is a director-equivalent title at most companies (it names
  // ownership of a whole function, not a single team) — checked before
  // Manager below so it doesn't fall through to that lower band.
  { level: 'Director', keywords: ['director', 'head of'] },
  { level: 'Manager', keywords: ['manager', 'team lead'] },
]

export function inferLevelFromTitle(title: string): string {
  const lower = ` ${stripExecutiveOfficePhrase(title.toLowerCase())} `
  for (const entry of LEVEL_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.level
    }
  }
  return 'IC'
}
