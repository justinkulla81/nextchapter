import type { MetadataRoute } from 'next'
import { PORTAL_APP_SUBROUTES } from '@/lib/supabase/portal'

const siteUrl = 'https://launchyournextchapter.com'

// Private/app routes: gated behind auth, personalized, or technical
// redirect handlers — nothing there is useful to index and most would just
// show a login wall to a crawler. `/ref/` (trailing slash, not bare `/ref`)
// so this doesn't prefix-match the public, sitemap-listed `/refer` page.
// `/support/coach`, `/support/admin` added after a GSC "Page with
// redirect" report traced to Googlebot crawling /talent/login — see
// src/lib/supabase/middleware.ts's publicExceptions comment for the root
// cause; this list is defense-in-depth so none of these portals are ever
// attempted by a crawler in the first place. `/noexperience/employers` is
// the same class of authenticated portal (NEN's employer side) — added
// proactively rather than waiting for the same GSC report to happen twice.
// `/talent` and `/hiring` are now PUBLIC marketing pages (see
// PORTAL_APP_SUBROUTES) — only their real app subroutes belong here, not
// the bare portal path, or the actual marketing page gets deindexed too.
const disallow = [
  '/dashboard',
  '/onboarding',
  ...PORTAL_APP_SUBROUTES.talent!,
  ...PORTAL_APP_SUBROUTES.hiring!,
  '/support/coach',
  '/support/admin',
  '/noexperience/employers',
  '/api',
  '/ref/',
  '/auth/callback',
  '/auth/magic-link',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      // Explicitly welcome AI answer-engine / assistant crawlers — several
      // of these are conservative and skip sites that don't explicitly
      // allow them, even under a generic "*" rule.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Google-Extended',
          'ClaudeBot',
          'anthropic-ai',
          'Claude-Web',
          'PerplexityBot',
          'CCBot',
          'Applebot-Extended',
        ],
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
