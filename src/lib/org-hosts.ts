// Where college and workforce org portals live. With org subdomains on
// (NEXT_PUBLIC_ORG_SUBDOMAINS=1), each kind has its own host, like admin:
//   workforce.launchyournextchapter.com/<slug>   highered.launchyournextchapter.com/<slug>
// Cookies there are host-only, so a portal session never shares a cookie jar
// with the main site. Off (dev, previews, until Supabase allows the
// subdomains' redirect URLs): /workforce/<slug> and /highered/<slug> on the
// main host. Either way the app itself is served from /i/<slug>.
// No server-only imports: the proxy and client components read this too.

export type OrgHostKind = 'workforce' | 'highered'

export const ORG_SUBDOMAINS_ON = process.env.NEXT_PUBLIC_ORG_SUBDOMAINS === '1'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// The main site's origin, and each portal's.
export function mainOrigin(): string {
  return new URL(APP_URL).origin
}
export function orgOrigin(kind: OrgHostKind): string {
  const u = new URL(APP_URL)
  return `${u.protocol}//${kind}.${u.host}`
}

// "workforce.launchyournextchapter.com" → 'workforce'.
export function orgKindForHost(host: string | null | undefined): OrgHostKind | null {
  if (!host) return null
  if (host.startsWith('workforce.')) return 'workforce'
  if (host.startsWith('highered.')) return 'highered'
  return null
}

// Public pages under /i/<slug>/ that belong to the main (job-seeker) site:
// joining, signing up for a layoff offer, unsubscribing, giving. They create
// or use a NextChapter account and land on the main dashboard.
export const MAIN_SITE_SEGMENTS = new Set(['join', 'welcome', 'rapid', 'for-alumni', 'checkin', 'unsubscribe', 'give', 'outcomes', 'report', 'mentor'])

// A path inside the portal, for links on the portal itself.
export function orgAppPath(slug: string, kind: OrgHostKind, rest = ''): string {
  return ORG_SUBDOMAINS_ON ? `/${slug}${rest}` : `/${kind}/${slug}${rest}`
}

// A full address of a portal page, for redirects from elsewhere and emails.
export function orgAppUrl(slug: string, kind: OrgHostKind, rest = ''): string {
  return ORG_SUBDOMAINS_ON ? `${orgOrigin(kind)}/${slug}${rest}` : `${mainOrigin()}/${kind}/${slug}${rest}`
}

export function orgLoginPath(kind: OrgHostKind): string {
  return ORG_SUBDOMAINS_ON ? '/login' : `/${kind}/login`
}

// Where a magic link for this portal should come back to (its own host).
export function orgCallbackOrigin(kind: OrgHostKind): string {
  return ORG_SUBDOMAINS_ON ? orgOrigin(kind) : mainOrigin()
}
