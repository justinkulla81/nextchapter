import type { PortalType } from './portals'
import { portalMeta } from './portals'
import { orgAppUrl } from '@/lib/org-hosts'
import { urlForAppPath } from '@/lib/portal-hosts'

// A customer's front door: one branded page listing their portals, at
// <slug>.<site> when customer subdomains are on (NEXT_PUBLIC_CUSTOMER_SUBDOMAINS=1,
// which needs a wildcard DNS entry and wildcard domain), and always at /p/<slug>
// on the main site. The page holds no customer data, only names, brand and links.
// No server-only imports: the proxy reads this too.

export const CUSTOMER_SUBDOMAINS_ON = process.env.NEXT_PUBLIC_CUSTOMER_SUBDOMAINS === '1'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Host labels that belong to the app, so a customer can never take one.
const RESERVED = new Set(['www', 'admin', 'api', 'app', 'mail', 'ftp', 'highered', 'workforce', 'recruiter', 'coach', 'organization', 'candidate', 'p', 'i'])

export const isReservedSlug = (slug: string): boolean => RESERVED.has(slug)

/** "cmu.launchyournextchapter.com" → "cmu"; anything else (or a reserved name) → null. */
export function customerSlugForHost(host: string | null | undefined, appUrl: string = APP_URL): string | null {
  if (!host) return null
  const base = new URL(appUrl).host
  const bare = host.toLowerCase()
  if (!bare.endsWith(`.${base}`)) return null
  const label = bare.slice(0, -(base.length + 1))
  if (!/^[a-z0-9][a-z0-9-]*$/.test(label) || RESERVED.has(label)) return null
  return label
}

/** The address to give a customer. */
export function frontDoorUrl(slug: string, appUrl: string = APP_URL, subdomains: boolean = CUSTOMER_SUBDOMAINS_ON): string {
  const u = new URL(appUrl)
  return subdomains ? `${u.protocol}//${slug}.${u.host}` : `${u.origin}/p/${slug}`
}

export interface FrontDoorLink {
  type: PortalType
  label: string
  blurb: string
  href: string
}

/** Where the customer signs in to each portal they own. */
export function portalLinks(slug: string, types: PortalType[]): FrontDoorLink[] {
  return types
    .filter((t) => portalMeta(t).available)
    .map((type) => {
      const m = portalMeta(type)
      const href = type === 'HIGHER_ED' ? orgAppUrl(slug, 'highered') : urlForAppPath(m.signInPath)
      return { type, label: m.label, blurb: m.blurb, href }
    })
}
