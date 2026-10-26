import type { MetadataRoute } from 'next'
import { PORTAL_APP_SUBROUTES } from '@/lib/supabase/portal'
import { HEAVY_PAGES_PAUSED, PAUSED_HEAVY_PREFIXES } from '@/lib/paused-pages'

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
// `/talent` is now a PUBLIC marketing page (see PORTAL_APP_SUBROUTES) —
// only its real app subroutes belong here, not the bare portal path, or
// the actual marketing page gets deindexed too.
const disallow = [
  '/dashboard',
  '/onboarding',
  ...PORTAL_APP_SUBROUTES.talent!,
  '/support/coach',
  '/support/admin',
  '/noexperience/employers',
  '/api',
  '/ref/',
  '/auth/callback',
  '/auth/magic-link',
]

export default function robots(): MetadataRoute.Robots {
  // While the heavy pages are paused (see src/proxy.ts), tell crawlers not to ask for them.
  const paused = HEAVY_PAGES_PAUSED() ? PAUSED_HEAVY_PREFIXES : []
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...disallow, ...paused],
      },
      // Explicitly welcome AI answer-engine / assistant crawlers — several
      // of these are conservative and skip sites that don't explicitly
      // allow them, even under a generic "*" rule.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'Google-Extended',
          'ClaudeBot',
          'Claude-SearchBot',
          'Claude-User',
          'anthropic-ai',
          'Claude-Web',
          'PerplexityBot',
          'Perplexity-User',
          'meta-externalagent',
          'meta-externalfetcher',
          'Bingbot',
          'CCBot',
          'Applebot-Extended',
          // Search and assistant fetchers named in each vendor's crawler docs.
          'OAI-SearchBot',
          'Claude-SearchBot',
          'Claude-User',
          'Perplexity-User',
          'Applebot',
          'Amazonbot',
          'DuckAssistBot',
          'MistralAI-User',
          'meta-externalagent',
          'meta-externalfetcher',
          'Bytespider',
          'Bingbot',
        ],
        allow: '/',
        disallow: [...disallow, ...paused],
      },
    ],
    // The index lists /sitemap.xml and the job sitemaps (/jobs/sitemap/N.xml).
    sitemap: [`${siteUrl}/sitemap-index.xml`, `${siteUrl}/sitemap.xml`],
  }
}
