import type { Metadata } from 'next'

/**
 * A page's own canonical, as a metadata fragment to spread in:
 * `export const metadata = { title, description, ...canonical('/pricing') }`.
 *
 * The root layout deliberately sets no canonical: Next.js copies a parent's
 * `alternates` into every page that doesn't set its own, and a root canonical
 * of "/" told Google that /pricing (and every other page without one) was a
 * duplicate of the homepage. Each public page declares its own instead.
 */
export function canonical(path: string): Pick<Metadata, 'alternates'> {
  return { alternates: { canonical: path } }
}

/**
 * `canonical(path)` plus the feed autodiscovery links, so a reader app pointed
 * at the page finds the layoff and report feeds. A page's own `alternates`
 * replaces the parent's whole, so each page that should advertise feeds spreads
 * this instead of relying on the root layout.
 */
export function canonicalWithFeeds(path: string): Pick<Metadata, 'alternates'> {
  return {
    alternates: {
      canonical: path,
      types: {
        'application/rss+xml': [
          { url: '/feeds/layoffs', title: 'NextChapter layoff notices' },
          { url: '/news/feed.xml', title: 'NextChapter monthly employment report and news' },
        ],
      },
    },
  }
}

/**
 * For utility pages nobody should land on from a search: sign-in, sign-up,
 * password reset, one-time token links, thank-you screens. Links on them are
 * still followed.
 */
export const NOINDEX: Pick<Metadata, 'robots'> = { robots: { index: false, follow: true } }
