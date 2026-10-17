// The job function on board rows (ExclusiveJobPosting.targetFunction) and the
// board's Function filter. The crawler classifies every job's function
// (ncrawl taxonomy + ncrawl/function_fallback.py) as a code; the import stores
// the display label here. Codes that exist in the member's own function list
// (PRIMARY_FUNCTION_OPTIONS) map to that exact label, so fit scoring compares
// like with like; the rest keep a plain label of their own. Pure.

import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

export const CRAWLER_FUNCTION_LABEL: Record<string, string> = {
  engineering: 'Engineering',
  operations: 'Operations',
  finance: 'Finance',
  data_ai: 'Data & Analytics',
  sales: 'Sales',
  people: 'Human Resources',
  marketing: 'Marketing',
  legal: 'Legal',
  product: 'Product',
  design: 'Design',
  customer: 'Customer Success',
  administration: 'Administration',
  executive: 'Executive Leadership',
  clinical: 'Clinical',
  investment: 'Investment',
  security: 'Security',
  programs: 'Programs',
  strategy: 'Strategy',
  development: 'Fundraising & development',
  research: 'Research',
  academic: 'Academic',
}

/** Filter options, alphabetical by label. `key` goes in the URL (fn=data_ai). */
export const JOB_FUNCTION_OPTIONS: { key: string; label: string }[] = Object.entries(CRAWLER_FUNCTION_LABEL)
  .map(([key, label]) => ({ key, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

const LABEL_TO_KEY = new Map(Object.entries(CRAWLER_FUNCTION_LABEL).map(([k, v]) => [v.toLowerCase(), k]))

/** Crawler code -> stored label; null for blank or unknown codes (never guessed). */
export function functionLabelFor(code: string | null | undefined): string | null {
  const c = (code ?? '').trim().toLowerCase()
  if (!c) return null
  if (CRAWLER_FUNCTION_LABEL[c]) return CRAWLER_FUNCTION_LABEL[c]
  // Already a label (a re-import, or a hand-posted job using the member list).
  return LABEL_TO_KEY.has(c) ? CRAWLER_FUNCTION_LABEL[LABEL_TO_KEY.get(c)!] : null
}

/** The `fn` URL parameter -> filter key, or null. */
export function parseFunctionParam(raw: string | null | undefined): string | null {
  const k = (raw ?? '').trim().toLowerCase()
  return CRAWLER_FUNCTION_LABEL[k] ? k : null
}

/** A predicate for board rows in one function (by stored label, case-insensitive). */
export function functionKeep(key: string): (p: { targetFunction: string | null }) => boolean {
  const label = CRAWLER_FUNCTION_LABEL[key].toLowerCase()
  return (p) => (p.targetFunction ?? '').toLowerCase() === label
}

const MEMBER_FUNCTIONS = new Set<string>(PRIMARY_FUNCTION_OPTIONS.map((f) => f.toLowerCase()))
/**
 * A job's function for fit scoring: the stored value, unless it is one of the
 * crawler-only labels with no equivalent in the member's own list ("Clinical",
 * "Investment"…) — then null, and the caller reads the title as before. Values a
 * person typed on a posting form pass through unchanged.
 */
export function memberVocabularyFunction(stored: string | null | undefined): string | null {
  if (!stored) return null
  const lower = stored.toLowerCase()
  if (MEMBER_FUNCTIONS.has(lower)) return stored
  return LABEL_TO_KEY.has(lower) ? null : stored
}
