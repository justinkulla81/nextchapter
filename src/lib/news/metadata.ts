import 'server-only'
import * as cheerio from 'cheerio'
import { detectNewsKind, embedsItself, podcastEmbed, safeImageUrl, sourceFromUrl, stripSourceSuffix, vimeoId, youtubeId, type NewsKind } from './kind'

export interface NewsMetadata {
  kind: NewsKind
  title: string | null
  blurb: string | null
  imageUrl: string | null
  source: string
}

const BLURB_MAX = 280
const TITLE_MAX = 200

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

function clean(text: string | null | undefined, max: number): string | null {
  let t = text ?? ''
  // Some publishers escape their descriptions twice, which leaves a literal
  // "&#x27;" where the apostrophe should be once the first layer is read.
  if (/&(#x?[0-9a-f]+|[a-z]+);/i.test(t)) t = cheerio.load(`<i>${t}</i>`)('i').text()
  t = t.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

interface OEmbed { title?: string; author_name?: string; thumbnail_url?: string; description?: string }

/** What a page says about itself in its Open Graph tags; nulls when it won't say. */
async function fetchOpenGraph(url: string): Promise<Omit<NewsMetadata, 'kind'>> {
  const fallback = { title: null, blurb: null, imageUrl: null, source: sourceFromUrl(url) }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: BROWSER_HEADERS })
    if (!res.ok) return fallback
    const $ = cheerio.load(await res.text())
    const meta = (...names: string[]) => {
      for (const n of names) {
        const v = $(`meta[property="${n}"]`).attr('content') ?? $(`meta[name="${n}"]`).attr('content')
        if (v?.trim()) return v
      }
      return null
    }
    const source = clean(meta('og:site_name'), 80) ?? fallback.source
    return {
      title: stripSourceSuffix(clean(meta('og:title', 'twitter:title') ?? $('title').first().text(), TITLE_MAX), source),
      blurb: clean(meta('og:description', 'twitter:description', 'description'), BLURB_MAX),
      imageUrl: safeImageUrl(meta('og:image:secure_url', 'og:image', 'twitter:image'), res.url || url),
      source,
    }
  } catch {
    return fallback
  }
}

/**
 * The headline, summary and picture a link offers about itself.
 *
 * No model call and nothing paid: videos and Spotify answer through their
 * public oEmbed endpoints, articles and Apple Podcasts through the Open
 * Graph tags every publisher sets for link previews. Instagram and LinkedIn
 * are not fetched at all — both refuse anonymous requests, and their own
 * embeds draw the post on the page instead.
 *
 * Never throws. A publisher that blocks the request (several do) comes back
 * with nulls, and the admin fills the headline in by hand.
 */
export async function fetchNewsMetadata(url: string): Promise<NewsMetadata> {
  const kind = detectNewsKind(url)

  if (kind === 'instagram') return { kind, title: null, blurb: null, imageUrl: null, source: 'Instagram' }
  if (kind === 'linkedin') return { kind, title: null, blurb: null, imageUrl: null, source: 'LinkedIn' }

  if (kind === 'podcast') {
    const host = podcastEmbed(url)!.host
    if (host === 'Spotify') {
      const data = await getJson<OEmbed>(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      return { kind, title: clean(data?.title, TITLE_MAX), blurb: null, imageUrl: safeImageUrl(data?.thumbnail_url), source: host }
    }
    const og = await fetchOpenGraph(url)
    return { kind, ...og, source: host }
  }

  if (kind === 'video') {
    const yt = youtubeId(url)
    const endpoint = yt
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vimeoId(url)}`)}`
    const data = await getJson<OEmbed>(endpoint)
    return {
      kind,
      title: clean(data?.title, TITLE_MAX),
      blurb: clean(data?.description, BLURB_MAX),
      // YouTube serves a thumbnail for every video at a fixed address, so a
      // refused oEmbed call still leaves the card with its picture.
      imageUrl: safeImageUrl(data?.thumbnail_url) ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null),
      source: clean(data?.author_name, 80) ?? (yt ? 'YouTube' : 'Vimeo'),
    }
  }

  return { kind, ...(await fetchOpenGraph(url)) }
}

/** A post or player that draws itself needs only a link that embeds; everything else needs a headline. */
export function isReadyToPublish(item: { newsKind: string | null; newsTitle: string | null; url: string }): boolean {
  if (item.newsKind === 'instagram' || item.newsKind === 'linkedin' || item.newsKind === 'podcast') {
    return embedsItself(item.newsKind, item.url)
  }
  return !!item.newsTitle?.trim()
}
