/**
 * What a News link is, decided from the URL alone.
 *
 * Kept free of network and database calls so the rules are testable: which
 * links play inline as video, which are Instagram posts, and what the
 * embeddable form of each is. Anything not recognised here is an article —
 * a link out with a headline and, where the page offers one, a picture.
 */
export type NewsKind = 'article' | 'video' | 'podcast' | 'linkedin' | 'instagram'

/** Every kind, in the order the News page lists them, with its plural for the filter. */
export const NEWS_KINDS: { key: NewsKind; label: string; plural: string }[] = [
  { key: 'article', label: 'Article', plural: 'Articles' },
  { key: 'video', label: 'Video', plural: 'Videos' },
  { key: 'podcast', label: 'Podcast', plural: 'Podcasts' },
  { key: 'linkedin', label: 'LinkedIn', plural: 'LinkedIn posts' },
  { key: 'instagram', label: 'Instagram', plural: 'Instagram posts' },
]

function parse(url: string): URL | null {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null
  } catch {
    return null
  }
}

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m)\./, '')

const YT_ID = /^[A-Za-z0-9_-]{11}$/

/** The 11-character id from any of YouTube's link shapes, or null. */
export function youtubeId(url: string): string | null {
  const u = parse(url)
  if (!u) return null
  const h = host(u)
  let id: string | null = null
  if (h === 'youtu.be') id = u.pathname.split('/')[1] ?? null
  else if (h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)
      id = m ? m[1] : null
    }
  }
  return id && YT_ID.test(id) ? id : null
}

/** The numeric id from a vimeo.com/123456789 link, or null. */
export function vimeoId(url: string): string | null {
  const u = parse(url)
  if (!u) return null
  const h = host(u)
  if (h !== 'vimeo.com' && h !== 'player.vimeo.com') return null
  const m = u.pathname.match(/\/(\d{6,})(?:\/|$)/)
  return m ? m[1] : null
}

/**
 * The canonical permalink Instagram's embed needs — a post, reel or TV link
 * with any username prefix, query string and tracking stripped. A profile
 * or story link is not embeddable and returns null.
 */
export function instagramPermalink(url: string): string | null {
  const u = parse(url)
  if (!u) return null
  const h = host(u)
  if (h !== 'instagram.com' && h !== 'instagr.am') return null
  const m = u.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)
  if (!m) return null
  return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`
}

/**
 * LinkedIn's embeddable address for a post.
 *
 * A post link carries its id in one of two shapes: the share link people
 * copy ("/posts/name_words-activity-7123-AbCd") or the feed link
 * ("/feed/update/urn:li:activity:7123"). A LinkedIn article ("/pulse/…") or
 * a profile is not a post and returns null — it is shown as an article link.
 */
export function linkedinEmbedUrl(url: string): string | null {
  const u = parse(url)
  if (!u || host(u) !== 'linkedin.com') return null
  const path = decodeURIComponent(u.pathname)
  const urn = path.match(/urn:li:(activity|share|ugcPost):(\d+)/)
  const slug = path.match(/^\/posts\/.*-(activity|share|ugcPost)-(\d+)(?:-|\/|$)/)
  const m = urn ?? slug
  return m ? `https://www.linkedin.com/embed/feed/update/urn:li:${m[1]}:${m[2]}` : null
}

export interface PodcastEmbed {
  src: string
  /** The player's own fixed height: an episode is a strip, a show is a list. */
  height: number
  host: 'Spotify' | 'Apple Podcasts'
}

/** The player for a Spotify or Apple Podcasts episode or show link, or null. */
export function podcastEmbed(url: string): PodcastEmbed | null {
  const u = parse(url)
  if (!u) return null
  const h = host(u)
  if (h === 'open.spotify.com') {
    // An optional "/intl-de" style prefix sits in front on shared links.
    const m = u.pathname.match(/^(?:\/intl-[a-z-]+)?\/(?:embed\/)?(episode|show)\/([A-Za-z0-9]+)/)
    if (!m) return null
    return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'episode' ? 152 : 352, host: 'Spotify' }
  }
  if (h === 'podcasts.apple.com' || h === 'embed.podcasts.apple.com') {
    if (!/\/podcast\/.*\/id\d+/.test(u.pathname) && !/\/podcast\/id\d+/.test(u.pathname)) return null
    const episode = u.searchParams.get('i')
    const qs = episode && /^\d+$/.test(episode) ? `?i=${episode}` : ''
    // 175 for a show as well: its taller layout leaves most of the frame
    // blank, and the strip already plays the latest episode.
    return { src: `https://embed.podcasts.apple.com${u.pathname}${qs}`, height: 175, host: 'Apple Podcasts' }
  }
  return null
}

export function detectNewsKind(url: string): NewsKind {
  if (youtubeId(url) || vimeoId(url)) return 'video'
  if (podcastEmbed(url)) return 'podcast'
  if (linkedinEmbedUrl(url)) return 'linkedin'
  if (instagramPermalink(url)) return 'instagram'
  return 'article'
}

/**
 * Kinds whose card is the host's own embed — the post or player draws
 * itself, so no headline is needed to publish, only a link that embeds.
 */
export function embedsItself(kind: string | null, url: string): boolean {
  if (kind === 'instagram') return instagramPermalink(url) !== null
  if (kind === 'linkedin') return linkedinEmbedUrl(url) !== null
  if (kind === 'podcast') return podcastEmbed(url) !== null
  return false
}

/** The player URL for a video link, or null when it isn't one we can play. */
export function videoEmbedUrl(url: string): string | null {
  const yt = youtubeId(url)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`
  const vm = vimeoId(url)
  if (vm) return `https://player.vimeo.com/video/${vm}?autoplay=1`
  return null
}

/** "inc.com" from a full link — the fallback when a page names no publisher. */
export function sourceFromUrl(url: string): string {
  const u = parse(url)
  return u ? host(u) : ''
}

/** Only https pictures: an http one is blocked as mixed content on our pages. */
export function safeImageUrl(raw: string | null | undefined, base?: string): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim(), base)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}
