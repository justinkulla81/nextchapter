import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { FeedCopy } from '@/components/press/FeedCopy'
import { feedGroups, feedUrl } from '@/lib/feeds/catalog'
import { FEED_LICENSE } from '@/lib/feeds/rss'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/keywords'
import { canonicalWithFeeds } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'

export const revalidate = 86400

const PATH = '/feeds'
export const metadata: Metadata = { ...pageMetadata(PATH), ...canonicalWithFeeds(PATH) }

const H2 = 'text-2xl font-bold tracking-tight text-navy'
const LINK = 'text-brand underline underline-offset-4'

export default function FeedsPage() {
  const groups = feedGroups()
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Feeds', path: PATH }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Layoff, report and conference feeds</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            The monthly White Collar Employment Report and new WARN layoff notices as they reach us, free, by state or industry, each with the state&apos;s own record linked, how the notice compares, and help for the people affected. For reporters, HR teams, recruiters and anyone who wants to know first.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            Paste a feed address into any reader (Feedly, Inoreader, NetNewsWire, Reeder), or import <a href="/feeds/nextchapter.opml" className={LINK}>every feed at once as an OPML file</a>. Each feed also comes as JSON Feed: add <code className="rounded bg-muted px-1">?format=json</code> to its address. New notices are pushed to readers that support WebSub. {FEED_LICENSE} See <Link href="/press" className={LINK}>Press and data</Link> for citations and downloads, or the <Link href="/data" className={LINK}>full dataset</Link>.
          </p>

          {groups.map((g) => (
            <section key={g.id} aria-labelledby={g.id} className="mt-10">
              <h2 id={g.id} className={H2}>{g.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{g.blurb}</p>
              {g.id === 'start' || g.id === 'other' ? (
                <ul className="mt-4 space-y-3">
                  {g.feeds.map((f) => (
                    <li key={f.key} className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <a href={f.path} className="font-semibold text-navy underline underline-offset-4">{f.title}</a>
                        <p className="text-sm text-muted-foreground">{f.blurb}</p>
                      </div>
                      <FeedCopy url={feedUrl(f)} feedKey={f.key} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {g.feeds.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-2">
                      <a href={f.path} className={LINK}>{f.title.replace(/ layoff notices$/, '')}</a>
                      <Link href={f.page} className="text-xs text-muted-foreground underline underline-offset-2">page</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            A state notice list is a floor, not a count of every layoff, and a state may publish a notice days after the employer filed it. Items show the date we collected them. Feed addresses start with {SITE_URL}/feeds/.
          </p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
