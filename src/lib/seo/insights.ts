// The /insights articles: one registry for the index page, the sitemap, the
// author page and each article's byline and JSON-LD.

export interface InsightArticle {
  slug: string
  title: string
  description: string
  /** ISO date (YYYY-MM-DD). */
  lastUpdated: string
}

export const INSIGHT_ARTICLES: InsightArticle[] = [
  {
    slug: 'outplacement-vendor-questions',
    title: 'The questions to ask an outplacement vendor',
    description: 'Eight questions to put to every outplacement vendor you evaluate.',
    lastUpdated: '2026-10-25',
  },
  {
    slug: 'outplacement-reporting',
    title: 'What your outplacement report should show',
    description: 'Utilization isn’t outcome. What to ask your provider to report instead.',
    lastUpdated: '2026-10-25',
  },
  {
    slug: 'outplacement-account-after-contract',
    title: 'What happens to your outplacement account when the contract ends',
    description: 'What to ask before you sign, and what stays with the participant when a seat ends.',
    lastUpdated: '2026-10-25',
  },
]

export function insight(slug: string): InsightArticle {
  const a = INSIGHT_ARTICLES.find((x) => x.slug === slug)
  if (!a) throw new Error(`Unknown insight ${slug}`)
  return a
}
