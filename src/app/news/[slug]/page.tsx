import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { getNewsItemBySlug } from '@/lib/news/published'
import { newsDisplayTitle } from '@/lib/news/slug'
import { NEWS_KINDS } from '@/lib/news/kind'
import { newsTagLabel } from '@/lib/news/tags'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'

export const revalidate = 300

const SITE = 'https://launchyournextchapter.com'
const HOST_FOR: Record<string, string> = { linkedin: 'LinkedIn', instagram: 'Instagram' }

function linkOutLabel(kind: string, source: string): string {
  if (kind === 'video') return 'Watch the video'
  if (kind === 'podcast') return `Listen on ${source}`
  if (HOST_FOR[kind]) return `Open the post on ${HOST_FOR[kind]}`
  return source ? `Read the article at ${source}` : 'Read the article'
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = await getNewsItemBySlug(slug)
  if (!item) return { title: 'News' }
  const title = newsDisplayTitle(item)
  const description = (item.take ?? '').replace(/\s+/g, ' ').slice(0, 155)
  return {
    // The site layout adds the name.
    title,
    description,
    alternates: { canonical: `/news/${slug}` },
    openGraph: { title, description, type: 'article', url: `${SITE}/news/${slug}`, ...(item.imageUrl ? { images: [item.imageUrl] } : {}) },
  }
}

/**
 * One News item on its own page: our take first, then what the source says
 * in its own words, then the way out to it.
 *
 * Exists only for items that have a take. The take is the original writing
 * here; the source's headline and summary are quoted and credited, and the
 * link out is the page's main action.
 */
export default async function NewsItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getNewsItemBySlug(slug)
  if (!item || !item.take) notFound()

  const title = newsDisplayTitle(item)
  const kindLabel = NEWS_KINDS.find((k) => k.key === item.kind)?.label ?? 'Article'
  const paragraphs = item.take.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={{
        ...articleJsonLd({
          headline: title,
          path: `/news/${slug}`,
          description: paragraphs[0]?.slice(0, 300),
          datePublished: item.liveAt,
          dateModified: item.liveAt,
          image: item.imageUrl ?? undefined,
        }),
        // What the take is about, credited to where it lives.
        citation: { '@type': 'CreativeWork', name: title, url: item.url, ...(item.source ? { publisher: { '@type': 'Organization', name: item.source } } : {}) },
      }} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'News', path: '/news' }, { name: title, path: `/news/${slug}` }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <article className="mx-auto max-w-2xl px-6">
          <Link href="/news" className="text-sm text-muted-foreground hover:text-foreground">← All news</Link>

          <p className="mt-6 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {kindLabel}
            {item.source && <span className="font-normal normal-case tracking-normal"> · {item.source}</span>}
            <span className="font-normal normal-case tracking-normal"> · {item.dateLabel}</span>
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-navy sm:text-4xl">{title}</h1>
          <AuthorByline updated={item.liveAt} />

          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote publisher image, any host
            <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="mt-8 aspect-video w-full rounded-xl border border-border bg-white object-cover" />
          )}

          <section aria-labelledby="our-take" className="mt-8">
            <h2 id="our-take" className="text-sm font-semibold tracking-wide text-navy uppercase">Our take</h2>
            <div className="mt-3 space-y-4 text-lg leading-relaxed text-foreground">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          {item.blurb && (
            <section aria-labelledby="from-source" className="mt-10 rounded-xl border border-border bg-white p-6">
              <h2 id="from-source" className="text-sm font-semibold tracking-wide text-navy uppercase">
                {item.title ? `From ${item.source || 'the source'}` : `${item.source || 'The author'} wrote`}
              </h2>
              <blockquote cite={item.url} className="mt-3 border-l-2 border-border pl-4 text-muted-foreground">{item.blurb}</blockquote>
            </section>
          )}

          <div className="mt-8">
            <TrackedLink
              href={item.url} event="news_item_clicked"
              properties={{ itemId: item.id, kind: item.kind, source: item.source, placement: 'item_page' }}
              className="inline-flex items-center justify-center rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:bg-success-hover"
            >
              {linkOutLabel(item.kind, item.source)} →
            </TrackedLink>
          </div>

          {item.tags.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-1.5" aria-label="Topics">
              {item.tags.map((t) => (
                <li key={t}>
                  <Link href={`/news?topic=${t}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border hover:text-foreground">
                    {newsTagLabel(t)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </main>
      <PublicSiteFooter page="news" />
    </div>
  )
}
