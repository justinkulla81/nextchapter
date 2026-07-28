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

export function inferFunctionFromTitle(title: string): string | null {
  const lower = title.toLowerCase()
  for (const entry of FUNCTION_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.function
    }
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
  { level: 'Director', keywords: ['director'] },
  { level: 'Manager', keywords: ['manager', 'team lead', 'head of'] },
]

export function inferLevelFromTitle(title: string): string {
  const lower = ` ${title.toLowerCase()} `
  for (const entry of LEVEL_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.level
    }
  }
  return 'IC'
}
