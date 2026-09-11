/**
 * Placeholder strings that arrive where an organisation name belongs.
 *
 * A LinkedIn export writes "Self-employed" or "Independent" into the company
 * field, and the legacy sheets used "Not named" / "Not listed (public)". Left
 * alone these become organisations with real affiliations pointing at them —
 * so quick add, the completion queue and the CSV importer all filter through
 * here before creating a CrmOrganization.
 */
const ORG_NOISE = new Set([
  'none', 'not named', 'not listed (public)', 'not listed', 'independent',
  'self-employed', 'self employed', 'freelance', 'various', 'stealth',
  'stealth startup', 'stealth mode', 'multiple organizations', 'n/a', 'na',
  'unknown', 'confidential', 'retired', 'unemployed', 'private', '—', '-',
])

export function isRealOrgName(v: string | null | undefined): v is string {
  if (!v) return false
  const s = v.trim().toLowerCase()
  if (!s) return false
  return !ORG_NOISE.has(s)
}

/** Legal forms that normalizeOrgName leaves behind. */
const TRAILING_LEGAL = /\s+(lp|llp|gp|plc|sa|ag|nv|bv|pte|pty|ab|oy|as|kk|srl|spa|sarl|kg|mbh)$/

/**
 * Stricter organisation key, used for MATCHING only — the stored
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
