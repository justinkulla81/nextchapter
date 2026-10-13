/**
 * Readable URLs for organizations: /organizations/mastercard instead of a cuid.
 *
 * The slug is the normalized name (already unique on CrmOrganization) with
 * spaces as hyphens. Only names that round-trip exactly get one — a name with
 * "&" or other punctuation would be ambiguous to reverse, so it keeps its id
 * URL rather than risk resolving to the wrong organization.
 */
export function orgSlug(canonicalNameNormalized: string): string | null {
  if (!/^[a-z0-9]+( [a-z0-9]+)*$/.test(canonicalNameNormalized)) return null
  return canonicalNameNormalized.replace(/ /g, '-')
}

/** The canonical name a slug stands for. */
export function canonicalFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ')
}
