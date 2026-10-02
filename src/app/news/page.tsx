import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { NewsFeed } from '@/components/news/NewsFeed'
import { getPublishedNews } from '@/lib/news/published'

export const metadata: Metadata = {
  title: 'News — NextChapter',
  description: 'Articles, videos, podcasts and posts on the job market and searching for a job, picked by NextChapter.',
  alternates: { canonical: '/news' },
}

// Publishing in the admin clears this page straight away; the timer only
// covers a change made some other way.
export const revalidate = 300

export default async function NewsPage() {
  const items = await getPublishedNews(200)
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-bold tracking-tight text-navy">News</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Articles, videos, podcasts and posts on the job market and searching for a job.
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
        </div>
      </main>
      <PublicSiteFooter page="news" />
    </div>
  )
}
