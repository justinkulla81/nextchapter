/**
 * Placeholder strings that arrive where an organization name belongs.
 *
 * A LinkedIn export writes "Self-employed" or "Independent" into the company
 * field, and the legacy sheets used "Not named" / "Not listed (public)". Left
 * alone these become organizations with real affiliations pointing at them —
 * so quick add, the completion queue and the CSV importer all filter through
 * here before creating a CrmOrganization.
 */
const ORG_NOISE = new Set([
  'none', 'not named', 'not listed (public)', 'not listed', 'independent',
  'self-employed', 'self employed', 'freelance', 'various', 'stealth',
  'stealth startup', 'stealth mode', 'multiple organizations', 'n/a', 'na',
  'unknown', 'confidential', 'retired', 'unemployed', 'entrepreneur',
  'founder', 'advisor', 'private', '—', '-',
])

export function isRealOrgName(v: string | null | undefined): v is string {
  if (!v) return false
  // The People page's organization datalist offers "- Unemployed" /
  // "- Entrepreneur" as quick picks — the leading "- " is just a visual
  // marker in the dropdown, not part of the value these should match.
  const s = v.trim().replace(/^-+\s*/, '').toLowerCase()
  if (!s) return false
  return !ORG_NOISE.has(s)
}

/**
 * Which of the two noise words carries enough signal to stand in for a real
 * organization, so completing a profile from an export doesn't silently
 * discard "Workforce Strategy Advisor at Self-employed" down to nothing.
 * Kept narrower than ORG_NOISE on purpose — "confidential"/"stealth"/
 * "various" say nothing about which bucket someone belongs in, so those
 * stay unplaced rather than guessed at.
 */
export type OrgPlaceholderKind = 'unemployed' | 'freelancer'

const UNEMPLOYED_SIGNAL = new Set(['unemployed', 'retired'])
const FREELANCER_SIGNAL = new Set([
  'self-employed', 'self employed', 'independent', 'freelance', 'freelancer',
  'advisor', 'founder', 'entrepreneur', 'consultant', 'consulting',
])

export const ORG_PLACEHOLDER_NAME: Record<OrgPlaceholderKind, string> = {
  unemployed: '- Unemployed',
  freelancer: '- Freelancer',
}

/**
 * The People page's organization field offers these as datalist quick
 * picks. Typed out exactly, they're a deliberate choice, not vague export
 * text — isRealOrgName's noise filter (built for the latter) would
 * otherwise strip the leading "-", match the noise word underneath, and
 * silently clear the field instead of saving what was picked.
 */
export const ORG_QUICK_PICKS = ['- Unemployed', '- Entrepreneur', '- Advisor', '- Freelancer'] as const

export function isOrgQuickPick(v: string): boolean {
  return (ORG_QUICK_PICKS as readonly string[]).includes(v.trim())
}

export function placeholderOrgKindFor(companyRaw: string | null | undefined): OrgPlaceholderKind | null {
  if (!companyRaw) return null
  const s = companyRaw.trim().replace(/^-+\s*/, '').toLowerCase()
  if (!s) return null
  if (UNEMPLOYED_SIGNAL.has(s)) return 'unemployed'
  if (FREELANCER_SIGNAL.has(s)) return 'freelancer'
  return null
}

/** Legal forms that normalizeOrgName leaves behind. */
const TRAILING_LEGAL = /\s+(lp|llp|gp|plc|sa|ag|nv|bv|pte|pty|ab|oy|as|kk|srl|spa|sarl|kg|mbh)$/

/**
 * Stricter organization key, used for MATCHING only — the stored
 * canonicalNameNormalized stays whatever normalizeOrgName produced.
 *
 * normalizeOrgName strips Inc/LLC/Corp but not LP/LLP/GP, and does not
 * collapse a trailing parenthetical, so "Owl Ventures" and "Owl Ventures, LP"
 * are different keys to it. That function is deliberately not changed —
 * production Company matching depends on it and loosening it would merge
 * genuinely distinct companies app-wide.
 *
 * Both the importer and the dedupe pass match on THIS key, so re-running the
 * importer can no longer resurrect rows the dedupe just merged.
 */
export function strictOrgKey(name: string, normalize: (n: string) => string): string {
  const withoutParen = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  let k = normalize(withoutParen || name)
  let prev: string
  do { prev = k; k = k.replace(TRAILING_LEGAL, '') } while (k !== prev)
  return k.trim()
}
