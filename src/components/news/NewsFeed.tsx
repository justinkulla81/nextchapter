'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Play } from 'lucide-react'
import { NEWS_KINDS, instagramPermalink, linkedinEmbedUrl, podcastEmbed, videoEmbedUrl, type NewsKind } from '@/lib/news/kind'
import { NEWS_TAGS, newsTagLabel, type NewsTagKey } from '@/lib/news/tags'
import type { NewsItemView } from '@/lib/news/published'

type Placement = 'home' | 'news'

const KIND_LABEL = Object.fromEntries(NEWS_KINDS.map((k) => [k.key, k.label])) as Record<NewsKind, string>

const CARD = 'mb-6 break-inside-avoid overflow-hidden rounded-xl border border-border bg-white shadow-sm'

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

/** A publisher's picture, hotlinked. One that fails to load takes its space with it. */
function Picture({ src, className }: { src: string; className: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote publisher images, any host
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={className} />
  )
}

function ArticleCard({ item, onOpen }: { item: NewsItemView; onOpen: () => void }) {
  return (
    <a
      href={item.url} target="_blank" rel="noopener noreferrer" onClick={onOpen}
      className={`${CARD} group block transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none`}
    >
      {item.imageUrl && <Picture src={item.imageUrl} className="aspect-[16/9] w-full bg-off-white object-cover" />}
      <div className="p-5">
        <Meta item={item} />
        <h3 className="mt-2 line-clamp-3 text-lg leading-snug font-semibold text-navy group-hover:underline">
          {item.title}
        </h3>
        {item.blurb && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.blurb}</p>}
        <Tags tags={item.tags} />
        <p className="mt-3 text-sm font-medium text-primary">Read the article →</p>
      </div>
    </a>
  )
}

function VideoCard({ item, onOpen, onPlay }: { item: NewsItemView; onOpen: () => void; onPlay: () => void }) {
  const [playing, setPlaying] = useState(false)
  const embed = videoEmbedUrl(item.url)
  return (
    <article className={CARD}>
      <div className="relative aspect-video w-full bg-navy">
        {playing && embed ? (
          <iframe
            src={embed} title={item.title ?? 'Video'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button" aria-label={`Play video: ${item.title ?? ''}`}
            onClick={() => { setPlaying(true); onPlay() }}
            className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset"
          >
            {item.imageUrl && <Picture src={item.imageUrl} className="absolute inset-0 h-full w-full object-cover" />}
            <span className="absolute inset-0 bg-navy/20 transition-colors group-hover:bg-navy/35" aria-hidden />
            <span className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition-transform group-hover:scale-105" aria-hidden>
              <Play className="ml-0.5 size-6 fill-navy text-navy" />
            </span>
          </button>
        )}
      </div>
      <div className="p-5">
        <Meta item={item} />
        <h3 className="mt-2 line-clamp-3 text-lg leading-snug font-semibold text-navy">
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="hover:underline">
            {item.title}
          </a>
        </h3>
        {item.blurb && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.blurb}</p>}
        <Tags tags={item.tags} />
      </div>
    </article>
  )
}

/** A Spotify or Apple Podcasts player, at the fixed height each host gives its player. */
function PodcastCard({ item, onOpen }: { item: NewsItemView; onOpen: () => void }) {
  const embed = podcastEmbed(item.url)
  if (!embed) return null
  return (
    <article className={CARD}>
      <iframe
        src={embed.src} title={item.title ?? `Podcast on ${embed.host}`} loading="lazy" height={embed.height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
        className="block w-full border-0"
      />
      <div className="p-5">
        <Meta item={item} />
        {item.title && (
          <h3 className="mt-2 line-clamp-3 text-lg leading-snug font-semibold text-navy">
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="hover:underline">
              {item.title}
            </a>
          </h3>
        )}
        {item.blurb && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.blurb}</p>}
        <Tags tags={item.tags} />
      </div>
    </article>
  )
}

/**
 * LinkedIn's own embed of a post. It does not report its height, so the
 * frame is a fixed window that scrolls for a long post.
 */
function LinkedInCard({ item, onOpen }: { item: NewsItemView; onOpen: () => void }) {
  const embed = linkedinEmbedUrl(item.url)
  if (!embed) return null
  return (
    <article className={CARD}>
      <iframe src={embed} title="LinkedIn post" loading="lazy" height={520} allowFullScreen className="block w-full border-0" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Meta item={item} />
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="text-sm font-medium text-primary hover:underline">
          Open on LinkedIn →
        </a>
        {item.tags.length > 0 && <div className="w-full [&>ul]:mt-0"><Tags tags={item.tags} /></div>}
      </div>
    </article>
  )
}

declare global {
  interface Window { instgrm?: { Embeds: { process: () => void } } }
}

const IG_SCRIPT_ID = 'instagram-embed-js'

/**
 * Instagram's own embed: its script swaps the blockquote for the post —
 * picture, caption and all — and sizes it. Loaded once per page however many
 * posts there are, and only when one is actually on the page. Until it
 * loads (or if it is blocked), the blockquote stays as a plain link.
 */
function InstagramCard({ item, onOpen }: { item: NewsItemView; onOpen: () => void }) {
  const permalink = instagramPermalink(item.url)

  useEffect(() => {
    if (!permalink) return
    if (window.instgrm) { window.instgrm.Embeds.process(); return }
    const existing = document.getElementById(IG_SCRIPT_ID)
    const onLoad = () => window.instgrm?.Embeds.process()
    if (existing) { existing.addEventListener('load', onLoad); return () => existing.removeEventListener('load', onLoad) }
    const s = document.createElement('script')
    s.id = IG_SCRIPT_ID
    s.async = true
    s.src = 'https://www.instagram.com/embed.js'
    s.addEventListener('load', onLoad)
    document.body.appendChild(s)
  }, [permalink])

  if (!permalink) return null
  return (
    <article className="mb-6 break-inside-avoid">
      <div className="[&_iframe]:!m-0 [&_iframe]:!w-full [&_iframe]:!max-w-full [&_iframe]:!min-w-0 [&_iframe]:!rounded-xl">
        <blockquote
          className="instagram-media m-0 rounded-xl border border-border bg-white p-5 shadow-sm"
          data-instgrm-captioned="" data-instgrm-permalink={permalink} data-instgrm-version="14"
        >
          <Meta item={item} />
          <a href={permalink} target="_blank" rel="noopener noreferrer" onClick={onOpen}
            className="mt-2 block text-lg leading-snug font-semibold text-navy hover:underline">
            {item.title ?? 'View this post on Instagram'}
          </a>
        </blockquote>
      </div>
    </article>
  )
}

const SELECT = 'h-9 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand'

/**
 * The News cards — articles, videos, podcasts, LinkedIn and Instagram posts
 * — in one column flow, newest first.
 *
 * Columns rather than a grid because the kinds are different heights by
 * nature — an Instagram post is twice an article — and a grid would stretch
 * every row to its tallest card.
 *
 * `filterable` adds the two archive filters (type and topic). They narrow
 * what is already on the page, and the choice is written into the address
 * so a filtered view can be bookmarked or sent to someone.
 */
export function NewsFeed({ items, placement, filterable = false }: { items: NewsItemView[]; placement: Placement; filterable?: boolean }) {
  const posthog = usePostHog()
  const [kind, setKind] = useState('')
  const [topic, setTopic] = useState('')

  // Only what is actually there: a filter that can only ever return nothing
  // is not a choice.
  const kinds = useMemo(() => NEWS_KINDS.filter((k) => items.some((i) => i.kind === k.key)), [items])
  const topics = useMemo(() => NEWS_TAGS.filter((t) => items.some((i) => i.tags.includes(t.key))), [items])

  useEffect(() => {
    if (!filterable) return
    const q = new URLSearchParams(window.location.search)
    const k = q.get('type') ?? ''
    const t = q.get('topic') ?? ''
    // Read once on arrival, after hydration, so the server and the browser
    // render the same first page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (NEWS_KINDS.some((x) => x.key === k)) setKind(k)
    if (NEWS_TAGS.some((x) => x.key === t)) setTopic(t)
  }, [filterable])

  const shown = items.filter((i) => (!kind || i.kind === kind) && (!topic || i.tags.includes(topic as NewsTagKey)))

  function change(next: { kind?: string; topic?: string }) {
    const k = next.kind ?? kind
    const t = next.topic ?? topic
    setKind(k)
    setTopic(t)
    const q = new URLSearchParams()
    if (k) q.set('type', k)
    if (t) q.set('topic', t)
    window.history.replaceState(null, '', q.size > 0 ? `?${q}` : window.location.pathname)
    posthog?.capture('news_filter_changed', {
      type: k || 'all', topic: t || 'all',
      results: items.filter((i) => (!k || i.kind === k) && (!t || i.tags.includes(t as NewsTagKey))).length,
    })
  }

  const props = (item: NewsItemView) => ({ itemId: item.id, kind: item.kind, source: item.source, placement })
  return (
    <div>
      {filterable && (kinds.length > 1 || topics.length > 0) && (
        <div className="mb-8 flex flex-wrap items-end gap-4">
          {kinds.length > 1 && (
            <div>
              <label htmlFor="news-type" className="block text-xs font-medium text-muted-foreground">Type</label>
              <select id="news-type" value={kind} onChange={(e) => change({ kind: e.target.value })} className={`${SELECT} mt-1`}>
                <option value="">All types</option>
                {kinds.map((k) => <option key={k.key} value={k.key}>{k.plural}</option>)}
              </select>
            </div>
          )}
          {topics.length > 0 && (
            <div>
              <label htmlFor="news-topic" className="block text-xs font-medium text-muted-foreground">Topic</label>
              <select id="news-topic" value={topic} onChange={(e) => change({ topic: e.target.value })} className={`${SELECT} mt-1`}>
                <option value="">All topics</option>
                {topics.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          )}
          <p className="pb-2 text-sm text-muted-foreground" role="status">
            {shown.length} of {items.length}
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <p className="text-muted-foreground">Nothing matches those filters.</p>
          <button type="button" onClick={() => change({ kind: '', topic: '' })} className="mt-3 text-sm font-medium text-primary underline underline-offset-4">
            Show everything
          </button>
        </div>
      ) : (
        <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
          {shown.map((item) => {
            const onOpen = () => posthog?.capture('news_item_clicked', props(item))
            if (item.kind === 'instagram') return <InstagramCard key={item.id} item={item} onOpen={onOpen} />
            if (item.kind === 'linkedin') return <LinkedInCard key={item.id} item={item} onOpen={onOpen} />
            if (item.kind === 'podcast') return <PodcastCard key={item.id} item={item} onOpen={onOpen} />
            if (item.kind === 'video') {
              return <VideoCard key={item.id} item={item} onOpen={onOpen} onPlay={() => posthog?.capture('news_video_played', props(item))} />
            }
            return <ArticleCard key={item.id} item={item} onOpen={onOpen} />
          })}
        </div>
      )}
    </div>
  )
}
