import type { MetadataRoute } from 'next'

const siteUrl = 'https://launchyournextchapter.com'

// Private/app routes: gated behind auth, personalized, or technical
// redirect handlers — nothing there is useful to index and most would just
// show a login wall to a crawler.
const disallow = ['/dashboard', '/onboarding', '/api', '/ref', '/auth/callback', '/auth/magic-link']

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
