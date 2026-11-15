/**
 * Versions of a resume. The upload, as read, is the ORIGINAL; every other draft is a version of it that is
 * labelled with what it is for, so someone with a dozen drafts can tell them apart at a glance.
 */
export const DRAFT_KINDS = ['ORIGINAL', 'GENERAL', 'FUNCTION', 'INDUSTRY', 'COMPANY', 'JOB'] as const
export type DraftKind = (typeof DRAFT_KINDS)[number]

export const isDraftKind = (v: unknown): v is DraftKind => typeof v === 'string' && (DRAFT_KINDS as readonly string[]).includes(v)

/** Kinds a person can choose when making a version: four, so they sit side by side as buttons. ORIGINAL is only ever made by an import, GENERAL by older drafts. */
export const VERSION_KINDS: { kind: Exclude<DraftKind, 'ORIGINAL'>; label: string; targetNoun: string; example: string }[] = [
  { kind: 'FUNCTION', label: 'A function', targetNoun: 'Function', example: 'Finance, Operations, Product' },
  { kind: 'INDUSTRY', label: 'An industry', targetNoun: 'Industry', example: 'Healthcare, Fintech, Retail' },
  { kind: 'COMPANY', label: 'A company', targetNoun: 'Company', example: 'Stripe' },
  { kind: 'JOB', label: 'A specific job', targetNoun: 'Job', example: 'VP Finance at Stripe' },
]

export const KIND_BADGE: Record<DraftKind, string> = {
  ORIGINAL: 'Original',
  GENERAL: 'Version',
  FUNCTION: 'Function',
  INDUSTRY: 'Industry',
  COMPANY: 'Company',
  JOB: 'Job',
}

export const MAX_TARGET_LABEL = 80

export const cleanTargetLabel = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_TARGET_LABEL) : ''
  return s || null
}

/** A name for a new version that says what it is for: "Fintech version", "Stripe version". */
export function defaultVersionName(kind: DraftKind, targetLabel: string | null, baseName: string): string {
  const base = baseName.replace(/^Original\s*[—-]\s*/i, '').replace(/\s*\(copy\)$/i, '').trim()
  if (targetLabel) return `${targetLabel} version`.slice(0, 100)
  return `${base || 'Resume'} (${KIND_BADGE[kind].toLowerCase()})`.slice(0, 100)
}
