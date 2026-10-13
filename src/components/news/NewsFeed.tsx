import { Fragment } from 'react'
import Link from 'next/link'
import { NEWS_KINDS, instagramPermalink, linkedinEmbedUrl, podcastEmbed, videoEmbedUrl, youtubeId, type NewsKind } from '@/lib/news/kind'
import { newsTagLabel, type NewsTagKey } from '@/lib/news/tags'
import type { NewsItemView } from '@/lib/news/published'
import {
  NewsFilterGrid, NewsInstagramEmbed, NewsLink, NewsPicture, NewsVideoFrame,
  type NewsTrack,
} from './NewsFeedClient'

// Server component: the card markup renders on the server and ships no
// JavaScript. Only the click/play/filter behaviour lives in NewsFeedClient.

type Placement = 'home' | 'news'

const KIND_LABEL = Object.fromEntries(NEWS_KINDS.map((k) => [k.key, k.label])) as Record<NewsKind, string>

// Every card is the same box, whatever is in it. A post that is longer than
// the box scrolls inside it rather than making its card taller than its
// neighbours.
const CARD = 'flex h-[32rem] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm'
const BODY = 'flex min-h-0 flex-1 flex-col p-5'

function Meta({ item }: { item: NewsItemView }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {KIND_LABEL[item.kind]}
      {item.source && <span className="font-normal normal-case tracking-normal"> · {item.source}</span>}
      <span className="font-normal normal-case tracking-normal"> · {item.dateLabel}</span>
    </p>
  )
}

function Tags({ tags }: { tags: NewsTagKey[] }) {
  if (tags.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
      {tags.map((t) => (
        <li key={t} className="rounded-full bg-off-white px-2 py-0.5 text-xs text-muted-foreground">{newsTagLabel(t)}</li>
      ))}
    </ul>
  )
}

/** Beside a card's link out: the way to our own page on the item, when it has one. */
function TakeLink({ item }: { item: NewsItemView }) {
  if (!item.slug) return null
  return (
    <Link href={`/news/${item.slug}`} className="ml-4 text-primary hover:underline">Read our take →</Link>
  )
}

/**
 * The standard card: picture, then what kind of thing it is, then the words.
 *
 * Articles use it with a headline and a short summary. A LinkedIn or
 * Instagram post with a picture or caption on file uses it too, without a
 * headline — the caption is the content, so it gets the room instead.
 */
function ArticleCard({ item, track, cta = 'Read the article →' }: { item: NewsItemView; track: NewsTrack; cta?: string }) {
  const lines = item.title
    ? (item.imageUrl ? 'line-clamp-2' : 'line-clamp-6')
    : (item.imageUrl ? 'line-clamp-6' : 'line-clamp-[14]')
  const className = `${CARD} group transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none`
  const body = (
    <>
      {item.imageUrl && <NewsPicture src={item.imageUrl} className="aspect-video w-full shrink-0 bg-off-white object-cover" />}
      <div className={BODY}>
        <Meta item={item} />
        {item.title && (
          <h3 className="mt-2 line-clamp-3 text-lg leading-snug font-semibold text-navy group-hover:underline">
            {item.title}
          </h3>
        )}
        {/* With no picture, or no headline, there is room to say more. */}
        {item.blurb && (
          <p className={`mt-2 text-sm ${item.title ? 'text-muted-foreground' : 'text-foreground'} ${lines}`}>{item.blurb}</p>
        )}
        <div className="mt-auto pt-3">
          <div className="[&>ul]:mt-0"><Tags tags={item.tags} /></div>
          <p className="mt-3 text-sm font-medium text-primary">{item.slug ? 'Read our take →' : cta}</p>
        </div>
      </div>
    </>
  )
  // An item with our take opens its own page here first; that page carries
  // the link out. A NextChapter report is our own page too, so it opens in the
  // same tab. Everything else goes straight to the source in a new tab.
  if (item.slug) return <NewsLink href={`/news/${item.slug}`} internal track={track} className={className}>{body}</NewsLink>
  if (item.kind === 'report') return <NewsLink href={item.url} track={track} className={className}>{body}</NewsLink>
  return <NewsLink href={item.url} newTab track={track} className={className}>{body}</NewsLink>
}

const videoHost = (url: string) => (youtubeId(url) ? 'YouTube' : 'Vimeo')

function VideoCard({ item, track, played }: { item: NewsItemView; track: NewsTrack; played: NewsTrack }) {
  return (
    <article className={CARD}>
      <NewsVideoFrame embed={videoEmbedUrl(item.url)} title={item.title} imageUrl={item.imageUrl} played={played} />
      <div className={BODY}>
        <Meta item={item} />
        <h3 className="mt-2 line-clamp-3 text-lg leading-snug font-semibold text-navy">
          <NewsLink href={item.url} newTab track={track} className="hover:underline">
            {item.title}
          </NewsLink>
        </h3>
        {item.blurb && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.blurb}</p>}
        <div className="mt-auto pt-3">
          <div className="[&>ul]:mt-0"><Tags tags={item.tags} /></div>
          <p className="mt-3 text-sm font-medium">
            <NewsLink href={item.url} newTab track={track} className="text-primary hover:underline">
              Watch on {videoHost(item.url)} →
            </NewsLink>
            <TakeLink item={item} />
          </p>
        </div>
      </div>
    </article>
  )
}

/** A Spotify or Apple Podcasts player, at the fixed height each host gives its player. */
function PodcastCard({ item, track }: { item: NewsItemView; track: NewsTrack }) {
  const embed = podcastEmbed(item.url)
  if (!embed) return null
  return (
    <article className={CARD}>
      <iframe
        src={embed.src} title={item.title ?? `Podcast on ${embed.host}`} loading="lazy" height={embed.height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
        className="block w-full shrink-0 border-0"
      />
      <div className={BODY}>
        <Meta item={item} />
        {item.title && (
          <h3 className="mt-2 line-clamp-3 text-lg leading-snug font-semibold text-navy">
            <NewsLink href={item.url} newTab track={track} className="hover:underline">
              {item.title}
            </NewsLink>
          </h3>
        )}
        {item.blurb && <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{item.blurb}</p>}
        <div className="mt-auto pt-3">
          <div className="[&>ul]:mt-0"><Tags tags={item.tags} /></div>
          <p className="mt-3 text-sm font-medium">
            <NewsLink href={item.url} newTab track={track} className="text-primary hover:underline">
              Listen on {embed.host} →
            </NewsLink>
            <TakeLink item={item} />
          </p>
        </div>
      </div>
    </article>
  )
}

/** The strip under an embedded post: what it is, its topics, and the way out to it. */
function EmbedFooter({ item, track, href, label }: { item: NewsItemView; track: NewsTrack; href: string; label: string }) {
  return (
    <div className="shrink-0 border-t border-border px-5 py-3">
      <Meta item={item} />
      <div className="[&>ul]:mt-2"><Tags tags={item.tags} /></div>
      <p className="mt-2 text-sm font-medium">
        <NewsLink href={href} newTab track={track} className="text-primary hover:underline">{label}</NewsLink>
        <TakeLink item={item} />
      </p>
    </div>
  )
}

/**
 * LinkedIn's own embed of a post. It does not report its height, so the
 * frame takes what the card has left and scrolls for a long post.
 */
function LinkedInCard({ item, track }: { item: NewsItemView; track: NewsTrack }) {
  const embed = linkedinEmbedUrl(item.url)
  if (!embed) return null
  return (
    <article className={CARD}>
      <iframe src={embed} title="LinkedIn post" loading="lazy" allowFullScreen className="block min-h-0 w-full flex-1 border-0" />
      <EmbedFooter item={item} track={track} href={item.url} label="Open on LinkedIn →" />
    </article>
  )
}

function InstagramCard({ item, track }: { item: NewsItemView; track: NewsTrack }) {
  const permalink = instagramPermalink(item.url)
  if (!permalink) return null
  return (
    <article className={CARD}>
      <NewsInstagramEmbed permalink={permalink} title={item.title} track={track} />
      <EmbedFooter item={item} track={track} href={permalink} label="Open on Instagram →" />
    </article>
  )
}

function renderCard(item: NewsItemView, placement: Placement) {
  const props = { itemId: item.id, kind: item.kind, source: item.source, placement }
  const track: NewsTrack = { event: 'news_item_clicked', props }
  // A post with its picture or caption on file is laid out like
  // every other card; one without is shown through its host's embed.
  if ((item.kind === 'instagram' || item.kind === 'linkedin') && (item.imageUrl || item.blurb)) {
    const host = item.kind === 'instagram' ? 'Instagram' : 'LinkedIn'
    return <ArticleCard item={item} track={track} cta={`Open on ${host} →`} />
  }
  if (item.kind === 'instagram') return <InstagramCard item={item} track={track} />
  if (item.kind === 'linkedin') return <LinkedInCard item={item} track={track} />
  if (item.kind === 'podcast') return <PodcastCard item={item} track={track} />
  if (item.kind === 'video') return <VideoCard item={item} track={track} played={{ event: 'news_video_played', props }} />
  if (item.kind === 'report') return <ArticleCard item={item} track={track} cta="Read the report →" />
  return <ArticleCard item={item} track={track} />
}

/**
 * The News cards — articles, videos, podcasts, LinkedIn and Instagram posts
 * — in one grid of identical boxes, newest first, reading left to right.
 *
 * `filterable` adds the two archive filters (type and topic). They narrow
 * what is already on the page, and the choice is written into the address
 * so a filtered view can be bookmarked or sent to someone.
 */
export function NewsFeed({ items, placement, filterable = false }: { items: NewsItemView[]; placement: Placement; filterable?: boolean }) {
  if (filterable) {
    return (
      <NewsFilterGrid
        cards={items.map((item) => ({ id: item.id, kind: item.kind, tags: item.tags, node: renderCard(item, placement) }))}
      />
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
        <p className="text-muted-foreground">Nothing matches those filters.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <Fragment key={item.id}>{renderCard(item, placement)}</Fragment>)}
      </div>
    </div>
  )
}
