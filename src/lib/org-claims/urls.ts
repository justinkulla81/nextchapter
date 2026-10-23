import { orgSlug } from '@/lib/crm/org-slug'

export const SITE_URL = 'https://launchyournextchapter.com'

/** The organization's public claim page, or null when its name cannot be turned into a safe slug. */
export function claimUrlFor(canonicalNameNormalized: string, base: string = SITE_URL): string | null {
  const slug = orgSlug(canonicalNameNormalized)
  return slug ? `${base.replace(/\/$/, '')}/prepared/${slug}` : null
}
