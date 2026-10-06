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
    slug: 'outplacement-cost-per-employee',
    title: 'What outplacement actually costs, and what you get',
    description: 'Cost per employee by tier, plus a live calculator against published NextChapter pricing.',
    lastUpdated: '2026-08-15',
  },
  {
    slug: 'outplacement-vendor-questions',
    title: 'The questions to ask an outplacement vendor',
    description: 'Eight questions that separate a real evaluation from a sales pitch.',
    lastUpdated: '2026-08-15',
  },
  {
    slug: 'outplacement-reporting',
    title: 'Why your outplacement report says nothing',
    description: 'Utilization isn’t outcome. What to ask your provider to report instead.',
    lastUpdated: '2026-08-15',
  },
  {
    slug: 'outplacement-account-after-contract',
    title: 'What happens to your outplacement account when the contract ends',
    description: 'What to ask before you sign, and how a permanent alumni account changes the calculus.',
    lastUpdated: '2026-08-15',
  },
]

export function insight(slug: string): InsightArticle {
  const a = INSIGHT_ARTICLES.find((x) => x.slug === slug)
  if (!a) throw new Error(`Unknown insight ${slug}`)
  return a
}
