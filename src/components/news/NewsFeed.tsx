'use client'

import { useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { Play } from 'lucide-react'
import { instagramPermalink, videoEmbedUrl } from '@/lib/news/kind'
import type { NewsItemView } from '@/lib/news/published'

type Placement = 'home' | 'news'

const KIND_LABEL = { article: 'Article', video: 'Video', instagram: 'Instagram' } as const

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

/**
 * The News cards: articles, videos and Instagram posts in one column flow.
 *
 * Columns rather than a grid because the three kinds are different heights
 * by nature — an Instagram post is twice an article — and a grid would
 * stretch every row to its tallest card.
 */
export function NewsFeed({ items, placement }: { items: NewsItemView[]; placement: Placement }) {
  const posthog = usePostHog()
  const props = (item: NewsItemView) => ({ itemId: item.id, kind: item.kind, source: item.source, placement })
  return (
    <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
      {items.map((item) => {
        const onOpen = () => posthog?.capture('news_item_clicked', props(item))
        if (item.kind === 'instagram') return <InstagramCard key={item.id} item={item} onOpen={onOpen} />
        if (item.kind === 'video') {
          return <VideoCard key={item.id} item={item} onOpen={onOpen} onPlay={() => posthog?.capture('news_video_played', props(item))} />
        }
        return <ArticleCard key={item.id} item={item} onOpen={onOpen} />
      })}
    </div>
  )
}
