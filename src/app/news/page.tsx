import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { NewsFeed } from '@/components/news/NewsFeed'
import { getPublishedNews } from '@/lib/news/published'
import { newsDisplayTitle } from '@/lib/news/slug'
import { getLayoffTracker } from '@/lib/warn/public-tracker'
import { LayoffTracker } from '@/components/news/LayoffTracker'
import { getNationalLaborData } from '@/lib/market/bls-national'
import { StructuredData } from '@/components/StructuredData'

const SITE = 'https://launchyournextchapter.com'

export const metadata: Metadata = {
  title: 'News',
  description: 'Articles, videos, podcasts and posts on the job market and searching for a job, picked by NextChapter.',
  alternates: { canonical: '/news', types: { 'application/rss+xml': '/news/feed.xml' } },
}

// Publishing in the admin clears this page straight away; the timer only
// covers a change made some other way.
export const revalidate = 300

export default async function NewsPage() {
  const [items, tracker, national] = await Promise.all([getPublishedNews(200), getLayoffTracker(), getNationalLaborData()])
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'News — NextChapter',
        description: 'Articles, videos, podcasts and posts on the job market and searching for a job, picked by NextChapter.',
        url: `${SITE}/news`,
        publisher: { '@type': 'Organization', name: 'NextChapter', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.slice(0, 50).map((i, n) => ({
            '@type': 'ListItem',
            position: n + 1,
            name: newsDisplayTitle(i),
            url: i.slug ? `${SITE}/news/${i.slug}` : i.url,
          })),
        },
      }} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-bold tracking-tight text-navy">News</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Articles, videos, podcasts and posts on the job market and searching for a job. For our own data, read the
            monthly{' '}
            <a href="/reports/latest" className="text-primary underline underline-offset-4">NextChapter Displacement Report</a>{' '}
            and the{' '}
            <a href="/reports/white-collar-index" className="text-primary underline underline-offset-4">White-Collar Long-Term Unemployment Index</a>.
          </p>
          <div className="mt-10">
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-muted-foreground">
                Nothing posted yet. Check back soon.
              </p>
            ) : (
              <NewsFeed items={items} placement="news" filterable />
            )}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Follow along: <a href="/news/feed.xml" className="text-primary underline underline-offset-4">RSS feed</a>
          </p>

          {tracker && (
            <div className="mt-20 border-t border-border pt-16">
              <LayoffTracker data={tracker} national={national} />
              <p className="mt-6 text-sm">
                <Link href="/layoffs" className="font-semibold text-brand hover:underline">
                  See the full layoff tracker, with a page for every state and employer →
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
      <PublicSiteFooter page="news" />
    </div>
  )
}
