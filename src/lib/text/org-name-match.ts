// Shared organization-name normalization/matching — originally two small
// local functions in the layoff-cohorts admin page (normalize/companiesMatch),
// lifted here and hardened once four+ consumers need the same logic
// (resume-derived work-history/education dedup, Community group bucketing).

const CORPORATE_SUFFIXES = [
  'incorporated',
  'inc',
  'llc',
  'l l c',
  'ltd',
  'limited',
  'corporation',
  'corp',
  'company',
  'co',
  'plc',
  'gmbh',
  'sa',
  'nv',
  'ag',
]

// Lowercased, punctuation-stripped, whitespace-collapsed, leading "the "
// dropped, trailing corporate suffix dropped. This is what gets stored in
// companyNameNormalized/schoolNameNormalized.
export function normalizeOrgName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/[.,'’]/g, '')
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.startsWith('the ')) {
    normalized = normalized.slice(4)
  }

  for (const suffix of CORPORATE_SUFFIXES) {
    const withSuffix = ` ${suffix}`
    if (normalized.endsWith(withSuffix)) {
      normalized = normalized.slice(0, -withSuffix.length).trim()
      break
    }
  }

  return normalized
}

// Loose match — containment either direction, but only once both normalized
// strings are long enough (>=4 chars) that containment is meaningful.
// Without that guard, "Meta" would match "Metabase" and short acronyms would
// match almost anything. Intended for company dedup during resume sync,
// where "Google" and "Google LLC" should collapse to one entry.
export function orgNamesMatch(a: string, b: string): boolean {
  const normA = normalizeOrgName(a)
  const normB = normalizeOrgName(b)
  if (!normA || !normB) return false
  if (normA === normB) return true

  // Some sources squash a multi-word name together with no space at all —
  // e.g. a LinkedIn application-confirmation subject naming the company
  // "CarterPierce" vs a candidate's own manually typed "Carter Pierce".
  // Comparing with internal spaces stripped catches this without the
  // false-positive risk plain containment below would add for short names.
  const tightA = normA.replace(/\s+/g, '')
  const tightB = normB.replace(/\s+/g, '')
  if (tightA.length >= 4 && tightA === tightB) return true

  if (normA.length < 4 || normB.length < 4) return false
  return normA.includes(normB) || normB.includes(normA)
}

// Strict match — normalized equality only, no containment. Required for
// schools: containment is actively wrong there ("Michigan" is contained in
// "Michigan State University", "Miami" in "Miami University (Ohio)",
// "Washington" in "Washington University in St. Louis") — school-name
// variants are handled by explicit alias lists (exec-ed-by-school.ts), not
// fuzzy matching.
export function orgNamesMatchStrict(a: string, b: string): boolean {
  return normalizeOrgName(a) === normalizeOrgName(b)
}
