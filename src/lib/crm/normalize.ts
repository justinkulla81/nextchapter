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
