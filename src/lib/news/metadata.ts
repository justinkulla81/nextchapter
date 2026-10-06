import 'server-only'
import * as cheerio from 'cheerio'
import { detectNewsKind, embedsItself, linkedinEmbedUrl, podcastEmbed, safeImageUrl, sourceFromUrl, stripSourceSuffix, vimeoId, youtubeId, type NewsKind } from './kind'

export interface NewsMetadata {
  kind: NewsKind
  title: string | null
  blurb: string | null
  imageUrl: string | null
  source: string
  /** When the publisher released it, when the page says. */
  publishedAt: Date | null
}

const BLURB_MAX = 280
// A post has no headline; its own words are the content, so more of them are kept.
const CAPTION_MAX = 600
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

/** A date a page claims, if it's a real one: parseable, not before 1995, not in the future. */
function plausibleDate(v: string | null | undefined): Date | null {
  if (!v?.trim()) return null
  const d = new Date(v.trim())
  if (isNaN(d.getTime())) return null
  if (d.getUTCFullYear() < 1995 || d.getTime() > Date.now() + 2 * 86_400_000) return null
  return d
}

/**
 * The publication date a page states about itself, from the places
 * publishers put it: article/Open Graph tags, the common news-CMS meta
 * names, schema.org JSON-LD, then a <time datetime> in the article.
 */
function pagePublishedAt($: cheerio.CheerioAPI): Date | null {
  const metaNames = [
    'article:published_time', 'og:article:published_time', 'article:published', 'og:published_time',
    'datePublished', 'uploadDate', 'pubdate', 'publishdate', 'publish-date', 'publish_date', 'date',
    'parsely-pub-date', 'sailthru.date', 'dc.date', 'DC.date.issued', 'dcterms.created', 'music:release_date',
  ]
  for (const n of metaNames) {
    const v = $(`meta[property="${n}"]`).attr('content') ?? $(`meta[name="${n}"]`).attr('content') ?? $(`meta[itemprop="${n}"]`).attr('content')
    const d = plausibleDate(v)
    if (d) return d
  }
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const stack: unknown[] = [JSON.parse($(el).contents().text())]
      while (stack.length) {
        const node = stack.pop()
        if (Array.isArray(node)) { stack.push(...node); continue }
        if (node && typeof node === 'object') {
          const o = node as Record<string, unknown>
          const d = plausibleDate(typeof o.datePublished === 'string' ? o.datePublished : typeof o.uploadDate === 'string' ? o.uploadDate : null)
          if (d) return d
          for (const v of Object.values(o)) if (v && typeof v === 'object') stack.push(v)
        }
      }
    } catch { /* malformed block */ }
  }
  return plausibleDate($('article time[datetime], time[datetime]').first().attr('datetime'))
}

/** A LinkedIn post's time, from its activity id: the top bits are a millisecond timestamp. */
function linkedinPostDate(url: string): Date | null {
  const m = url.match(/(?:activity|share|ugcPost)[:-](\d{18,20})/)
  if (!m) return null
  try {
    return plausibleDate(new Date(Number(BigInt(m[1]) >> BigInt(22))).toISOString())
  } catch {
    return null
  }
}

/** A YouTube video's publish date, from the watch page (oEmbed doesn't carry one). */
async function youtubePublishedAt(id: string): Promise<Date | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${id}`, { signal: AbortSignal.timeout(8000), headers: BROWSER_HEADERS })
    if (!res.ok) return null
    return pagePublishedAt(cheerio.load(await res.text()))
  } catch {
    return null
  }
}

/** What a page says about itself in its Open Graph tags; nulls when it won't say. */
async function fetchOpenGraph(url: string): Promise<Omit<NewsMetadata, 'kind'>> {
  const fallback = { title: null, blurb: null, imageUrl: null, source: sourceFromUrl(url), publishedAt: null }
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
      publishedAt: pagePublishedAt($),
    }
  } catch {
    return fallback
  }
}

/**
 * A LinkedIn post's author, words and picture, read from the public page
 * LinkedIn serves for embedding — the same page the embed frame shows, so it
 * needs no sign-in. The picture is the post's image, or a video's cover
 * frame; the author's profile photo is not the picture.
 *
 * Nulls when LinkedIn will not answer, and the card then falls back to
 * LinkedIn's own embed.
 */
async function fetchLinkedInPost(url: string): Promise<Omit<NewsMetadata, 'kind'>> {
  const fallback = { title: null, blurb: null, imageUrl: null, source: 'LinkedIn', publishedAt: linkedinPostDate(url) }
  const embed = linkedinEmbedUrl(url)
  if (!embed) return fallback
  try {
    const res = await fetch(embed, { signal: AbortSignal.timeout(8000), headers: BROWSER_HEADERS })
    if (!res.ok) return fallback
    const $ = cheerio.load(await res.text())
    const description = $('meta[property="og:description"]').attr('content') ?? ''
    const author = $('[data-tracking-control-name="public_post_embed_feed-actor-name"]').first().text()
    const isPostMedia = (u: string | undefined) =>
      !!u && /licdn\.com/.test(u) && !/profile-displayphoto|company-logo|profile-framedphoto/.test(u)
    const candidates = [
      $('[data-poster-url]').first().attr('data-poster-url'),
      ...$('img').map((_, el) => $(el).attr('data-delayed-url') ?? $(el).attr('src')).get(),
    ]
    return {
      title: null,
      // "… | 478 comments on LinkedIn" is LinkedIn's addition, not the author's.
      blurb: clean(description.replace(/\s*\|\s*[\d,]+ comments? on LinkedIn\s*$/i, ''), CAPTION_MAX),
      imageUrl: safeImageUrl(candidates.find(isPostMedia)),
      source: clean(author, 80) ?? 'LinkedIn',
      publishedAt: linkedinPostDate(url),
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
 * Graph tags every publisher sets for link previews, LinkedIn posts through
 * the public page LinkedIn serves for embedding. Instagram is not fetched at
 * all — it refuses anonymous requests, and its own embed draws the post on
 * the page instead.
 *
 * Never throws. A publisher that blocks the request (several do) comes back
 * with nulls, and the admin fills the headline in by hand.
 */
export async function fetchNewsMetadata(url: string): Promise<NewsMetadata> {
  const kind = detectNewsKind(url)

  if (kind === 'instagram') return { kind, title: null, blurb: null, imageUrl: null, source: 'Instagram', publishedAt: null }
  if (kind === 'linkedin') return { kind, ...(await fetchLinkedInPost(url)) }

  if (kind === 'podcast') {
    const host = podcastEmbed(url)!.host
    if (host === 'Spotify') {
      const data = await getJson<OEmbed>(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      // Spotify's oEmbed carries no date; the episode page's metadata may.
      const og = await fetchOpenGraph(url)
      return { kind, title: clean(data?.title, TITLE_MAX), blurb: null, imageUrl: safeImageUrl(data?.thumbnail_url), source: host, publishedAt: og.publishedAt }
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
      publishedAt: yt ? await youtubePublishedAt(yt) : (await fetchOpenGraph(url)).publishedAt,
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
