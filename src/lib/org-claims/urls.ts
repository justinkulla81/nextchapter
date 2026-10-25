import { orgSlug } from '@/lib/crm/org-slug'

export const SITE_URL = 'https://launchyournextchapter.com'

/** Hand-picked page addresses for names that cannot be turned into a slug (the stored name 'merck &' is "Merck & Co" with the suffix stripped). */
const SLUG_OVERRIDES: Record<string, string> = { 'merck &': 'merck-and-co' }
const CANONICAL_FOR_OVERRIDE = new Map(Object.entries(SLUG_OVERRIDES).map(([c, s]) => [s, c]))

/** The address for an organization's page. Like orgSlug, but an ampersand reads as "and" (owens-and-minor). Null when the name still is not safe. */
export function claimSlug(canonicalNameNormalized: string): string | null {
  const override = SLUG_OVERRIDES[canonicalNameNormalized]
  if (override) return override
  const plain = orgSlug(canonicalNameNormalized)
  if (plain) return plain
  if (!canonicalNameNormalized.includes('&')) return null
  return orgSlug(canonicalNameNormalized.replace(/\s*&\s*/g, ' and ').trim())
}

/**
 * The stored names a page address could stand for. 'a-and-m' may be 'a and m', 'a & m' or 'a&m', so each '-and-' is tried both ways
 * (capped at three of them); the caller keeps only the name whose own claimSlug is exactly the address.
 */
export function canonicalCandidates(slug: string): string[] {
  const base = slug.replace(/-/g, ' ')
  const override = CANONICAL_FOR_OVERRIDE.get(slug)
  const out = new Set<string>(override ? [override, base] : [base])
  const parts = slug.split('-and-')
  if (parts.length > 1 && parts.length <= 4) {
    const seps = [' and ', ' & ', '&']
    const build = (i: number, acc: string): void => {
      if (i === parts.length) { out.add(acc.replace(/-/g, ' ')); return }
      for (const sep of seps) build(i + 1, acc + sep + parts[i])
    }
    build(1, parts[0])
  }
  return [...out]
}

/** The organization's public claim page, or null when its name cannot be turned into a safe slug. */
export function claimUrlFor(canonicalNameNormalized: string, base: string = SITE_URL): string | null {
  const slug = claimSlug(canonicalNameNormalized)
  return slug ? `${base.replace(/\/$/, '')}/prepared/${slug}` : null
}
