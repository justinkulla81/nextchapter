import type { MetadataRoute } from 'next'

const siteUrl = 'https://launchyournextchapter.com'

// Private/app routes: gated behind auth, personalized, or technical
// redirect handlers — nothing there is useful to index and most would just
// show a login wall to a crawler. `/ref/` (trailing slash, not bare `/ref`)
// so this doesn't prefix-match the public, sitemap-listed `/refer` page.
// `/talent`, `/support/coach`, `/support/admin` added after a GSC "Page
// with redirect" report traced to Googlebot crawling /talent/login — see
// src/lib/supabase/middleware.ts's publicExceptions comment for the root
// cause; this list is defense-in-depth so none of these portals are ever
// attempted by a crawler in the first place.
const disallow = [
  '/dashboard',
  '/onboarding',
  '/talent',
  '/support/coach',
  '/support/admin',
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
