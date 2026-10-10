// Officer roles an 8-K Item 5.02 filing can name, and what each one means
// for a candidate. Pure data + helpers — no server imports, so the parser
// tests and the client-side Company Tracker can both use it.

import { normalizeOrgName } from '@/lib/text/org-name-match'

export type OfficerRole =
  | 'CEO'
  | 'PRESIDENT'
  | 'CFO'
  | 'COO'
  | 'CTO'
  | 'CIO'
  | 'CHRO'
  | 'GC'
  | 'CMO'
  | 'CRO'
  | 'CPO'
  | 'CAO'
  | 'CSO'
  | 'CMEDO'

export const ROLE_LABELS: Record<OfficerRole, string> = {
  CEO: 'Chief Executive Officer',
  PRESIDENT: 'President',
  CFO: 'Chief Financial Officer',
  COO: 'Chief Operating Officer',
  CTO: 'Chief Technology Officer',
  CIO: 'Chief Information Officer',
  CHRO: 'Chief People Officer',
  GC: 'General Counsel',
  CMO: 'Chief Marketing Officer',
  CRO: 'Chief Revenue Officer',
  CPO: 'Chief Product Officer',
  CAO: 'Chief Accounting Officer',
  CSO: 'Chief Strategy Officer',
  CMEDO: 'Chief Medical Officer',
}

// Short form for tight spaces (Company Tracker row, admin table).
export const ROLE_SHORT: Record<OfficerRole, string> = {
  CEO: 'CEO',
  PRESIDENT: 'President',
  CFO: 'CFO',
  COO: 'COO',
  CTO: 'CTO',
  CIO: 'CIO',
  CHRO: 'CHRO',
  GC: 'General Counsel',
  CMO: 'CMO',
  CRO: 'CRO',
  CPO: 'CPO',
  CAO: 'CAO',
  CSO: 'Chief Strategy Officer',
  CMEDO: 'Chief Medical Officer',
}

// Which PRIMARY_FUNCTION_OPTIONS (src/lib/constants/onboarding.ts) a role
// opening is relevant to. A CFO search pulls in finance people; a new CEO's
// rebuild touches every function, so CEO/President map to the general
// leadership buckets and every function gets a smaller fit bonus elsewhere.
export const ROLE_FUNCTIONS: Record<OfficerRole, string[]> = {
  CEO: ['Executive Leadership', 'General', 'Operations'],
  PRESIDENT: ['Executive Leadership', 'General', 'Operations'],
  CFO: ['Finance'],
  COO: ['Operations', 'Executive Leadership'],
  CTO: ['Engineering', 'Product'],
  CIO: ['Engineering', 'Data & Analytics'],
  CHRO: ['Human Resources'],
  GC: ['Legal'],
  CMO: ['Marketing'],
  CRO: ['Sales', 'Customer Success'],
  CPO: ['Product', 'Design'],
  CAO: ['Finance'],
  CSO: ['Executive Leadership', 'Operations'],
  CMEDO: ['Other'],
}

// Ordered: longer / more specific patterns first. Each matches a title as it
// appears in filing prose ("Executive Vice President and Chief Financial
// Officer", "the Company's President and CEO").
export const ROLE_PATTERNS: { role: OfficerRole; re: RegExp }[] = [
  { role: 'CEO', re: /\bchief executive officer\b|\bCEO\b/gi },
  { role: 'CFO', re: /\bchief financial officer\b|\bCFO\b/gi },
  { role: 'COO', re: /\bchief operating officer\b|\bCOO\b/gi },
  { role: 'CTO', re: /\bchief technology officer\b|\bCTO\b/gi },
  { role: 'CIO', re: /\bchief (?:information|digital) officer\b|\bCIO\b/gi },
  { role: 'CHRO', re: /\bchief (?:human resources?|people|talent) officer\b|\bCHRO\b/gi },
  { role: 'GC', re: /\bgeneral counsel\b|\bchief legal officer\b/gi },
  { role: 'CMO', re: /\bchief marketing officer\b/gi },
  { role: 'CRO', re: /\bchief (?:revenue|commercial|sales) officer\b/gi },
  { role: 'CPO', re: /\bchief product officer\b/gi },
  { role: 'CAO', re: /\bchief accounting officer\b|\bprincipal accounting officer\b/gi },
  { role: 'CSO', re: /\bchief strategy officer\b/gi },
  { role: 'CMEDO', re: /\bchief medical officer\b/gi },
  // "President" but never "Vice President" / "Executive Vice President".
  { role: 'PRESIDENT', re: /(?<!vice[\s-])\bpresident\b/gi },
]

// Company key used to join SEC filer names to the names candidates type
// into the Company Tracker or have on their applications. normalizeOrgName
// plus the two SEC-specific quirks: state-of-incorporation tags ("/DE/") and
// "Holdings"/"Group" parents ("Tenable Holdings, Inc." -> "tenable").
// Always run BOTH sides of a comparison through this.
export function companyKey(name: string): string {
  const cleaned = name
    .replace(/\s*\/[A-Z]{2,3}\/?\s*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
  let key = normalizeOrgName(cleaned)
  for (let i = 0; i < 3; i++) {
    const next = key.replace(/\s+(holdings?|group|inc|corp|corporation|co|company|plc|ltd|llc|lp|the)$/, '').trim()
    if (next === key) break
    key = next
  }
  return key
}

export function isOfficerRole(value: string): value is OfficerRole {
  return value in ROLE_LABELS
}

export function roleShortLabel(value: string): string {
  return isOfficerRole(value) ? ROLE_SHORT[value] : value
}

// Candidate-facing name for each signal type.
export const SIGNAL_LABELS = {
  EXEC_DEPARTURE: 'Likely opening',
  EXEC_APPOINTMENT: 'New leadership',
  FUNDING_RAISE: 'New funding',
} as const
