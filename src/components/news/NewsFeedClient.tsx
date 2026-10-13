'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePostHog } from '@/lib/posthog/client'
import { Play } from 'lucide-react'
import { NEWS_KINDS, type NewsKind } from '@/lib/news/kind'
import { NEWS_TAGS, type NewsTagKey } from '@/lib/news/tags'

/**
 * The interactive pieces of the News cards. The card markup itself is
 * rendered on the server in NewsFeed.tsx; only what needs state, an event
 * handler or an effect lives here, so it is the only News code that ships to
 * the browser.
 */

export type NewsTrack = {
  event: string
  props: { itemId: string; kind: string; source: string; placement: string }
}

/** A link that reports a click. `internal` uses next/link (same-tab page navigation). */
export function NewsLink({
  href, track, internal = false, newTab = false, className, children,
}: {
  href: string
  track: NewsTrack
  internal?: boolean
  newTab?: boolean
  className?: string
  children: ReactNode
}) {
  const posthog = usePostHog()
  const onClick = () => posthog?.capture(track.event, track.props)
  if (internal) return <Link href={href} onClick={onClick} className={className}>{children}</Link>
  return (
    <a href={href} onClick={onClick} className={className} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  )
}

/** A publisher's picture, hotlinked. One that fails to load takes its space with it. */
export function NewsPicture({ src, className }: { src: string; className: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote publisher images, any host
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={className} />
  )
}

/** The video frame of a card: a poster with a play button, swapped for the embed on click. */
export function NewsVideoFrame({
  embed, title, imageUrl, played,
}: {
  embed: string | null
  title: string | null
  imageUrl: string | null
  played: NewsTrack
}) {
  const posthog = usePostHog()
  const [playing, setPlaying] = useState(false)
  return (
    <div className="relative aspect-video w-full shrink-0 bg-navy">
      {playing && embed ? (
        <iframe
          src={embed} title={title ?? 'Video'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button" aria-label={`Play video: ${title ?? ''}`}
          onClick={() => { setPlaying(true); posthog?.capture(played.event, played.props) }}
          className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset"
        >
          {imageUrl && <NewsPicture src={imageUrl} className="absolute inset-0 h-full w-full object-cover" />}
          <span className="absolute inset-0 bg-navy/20 transition-colors group-hover:bg-navy/35" aria-hidden />
          <span className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition-transform group-hover:scale-105" aria-hidden>
            <Play className="ml-0.5 size-6 fill-navy text-navy" />
          </span>
        </button>
      )}
    </div>
  )
}

declare global {
  interface Window { instgrm?: { Embeds: { process: () => void } } }
}

const IG_SCRIPT_ID = 'instagram-embed-js'

/**
 * Instagram's own embed: its script swaps the blockquote for the post —
 * picture, caption and all — at the post's full height, which scrolls
 * inside the card. Loaded once per page however many posts there are, and
 * only when one is actually on the page. Until it loads (or if it is
 * blocked), the blockquote stays as a plain link.
 */
export function NewsInstagramEmbed({ permalink, title, track }: { permalink: string; title: string | null; track: NewsTrack }) {
  useEffect(() => {
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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto [&_iframe]:!m-0 [&_iframe]:!w-full [&_iframe]:!max-w-full [&_iframe]:!min-w-0 [&_iframe]:!rounded-none [&_iframe]:!border-0">
      <blockquote
        className="instagram-media m-0 p-5"
        data-instgrm-captioned="" data-instgrm-permalink={permalink} data-instgrm-version="14"
      >
        <NewsLink href={permalink} newTab track={track}
          className="block text-lg leading-snug font-semibold text-navy hover:underline">
          {title ?? 'View this post on Instagram'}
        </NewsLink>
      </blockquote>
    </div>
  )
}

const SELECT = 'h-9 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand'

export type NewsFilterCard = { id: string; kind: NewsKind; tags: NewsTagKey[]; node: ReactNode }

/**
 * The archive's two filters (type and topic). They narrow what is already
 * on the page, and the choice is written into the address so a filtered
 * view can be bookmarked or sent to someone. The cards arrive already
 * rendered; this only chooses which of them to show.
 */
export function NewsFilterGrid({ cards }: { cards: NewsFilterCard[] }) {
  const posthog = usePostHog()
  const [kind, setKind] = useState('')
  const [topic, setTopic] = useState('')

  // Only what is actually there: a filter that can only ever return nothing
  // is not a choice.
  const kinds = useMemo(() => NEWS_KINDS.filter((k) => cards.some((i) => i.kind === k.key)), [cards])
  const topics = useMemo(() => NEWS_TAGS.filter((t) => cards.some((i) => i.tags.includes(t.key))), [cards])

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const k = q.get('type') ?? ''
    const t = q.get('topic') ?? ''
    // Read once on arrival, after hydration, so the server and the browser
    // render the same first page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (NEWS_KINDS.some((x) => x.key === k)) setKind(k)
    if (NEWS_TAGS.some((x) => x.key === t)) setTopic(t)
  }, [])

  const shown = cards.filter((i) => (!kind || i.kind === kind) && (!topic || i.tags.includes(topic as NewsTagKey)))

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
      results: cards.filter((i) => (!k || i.kind === k) && (!t || i.tags.includes(t as NewsTagKey))).length,
    })
  }

  return (
    <div>
      {(kinds.length > 1 || topics.length > 0) && (
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
            {shown.length} of {cards.length}
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => <Fragment key={c.id}>{c.node}</Fragment>)}
        </div>
      )}
    </div>
  )
}
