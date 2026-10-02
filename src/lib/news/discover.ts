import 'server-only'
import * as cheerio from 'cheerio'
import { prisma } from '@/lib/prisma'
import { safeImageUrl } from './kind'
import { DISCOVERY_TOPICS } from './discovery-topics'

/**
 * How many new links one topic may add in one run. Eleven topics at three
 * each is the most a day can add — enough to see what is being written,
 * few enough to read.
 */
const PER_TOPIC = 3

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
}

export interface DiscoveredArticle {
  url: string
  title: string
  description: string | null
  source: string | null
  imageUrl: string | null
  publishedAt: Date | null
}

/**
 * The publisher's own address out of a feed link.
 *
 * The feed wraps every link in a click-tracking redirect with the real
 * address in its `url` parameter. Storing the redirect would put a
 * tracking hop in front of every reader, and make the same article look
 * new each time its tracking id changed.
 */
export function unwrapFeedLink(link: string): string | null {
  try {
    const u = new URL(link)
    const inner = u.hostname.endsWith('bing.com') ? u.searchParams.get('url') : link
    if (!inner) return null
    const real = new URL(inner)
    if (real.protocol !== 'https:' && real.protocol !== 'http:') return null
    // Tracking parameters would make one article look like several.
    for (const k of [...real.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ocid|cmpid|ref$)/i.test(k)) real.searchParams.delete(k)
    }
    real.hash = ''
    return real.toString()
  } catch {
    return null
  }
}

/** One topic's articles from the past week, as the news search returns them. */
export async function searchTopic(query: string): Promise<DiscoveredArticle[]> {
  const url = new URL('https://www.bing.com/news/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'rss')
  url.searchParams.set('setlang', 'en-US')
  url.searchParams.set('cc', 'US')
  url.searchParams.set('qft', 'interval="8"') // past week
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: HEADERS })
  if (!res.ok) throw new Error(`News search failed: ${res.status}`)
  return parseFeed(await res.text())
}

export function parseFeed(xml: string): DiscoveredArticle[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out: DiscoveredArticle[] = []
  $('item').each((_, el) => {
    const item = $(el)
    const url = unwrapFeedLink(item.children('link').text().trim())
    const title = item.children('title').text().replace(/\s+/g, ' ').trim()
    if (!url || !title) return
    const date = new Date(item.children('pubDate').text())
    const image = item.children('News\\:Image').text().trim()
    out.push({
      url,
      title,
      description: item.children('description').text().replace(/\s+/g, ' ').trim() || null,
      source: item.children('News\\:Source').text().trim() || null,
      // The feed's picture is a small thumbnail address; the full one is
      // fetched from the article itself if the link is added to News.
      imageUrl: safeImageUrl(image),
      publishedAt: Number.isNaN(date.getTime()) ? null : date,
    })
  })
  return out
}

export interface DiscoveryResult {
  created: number
  byTopic: Record<string, number>
  failed: string[]
}

/**
 * Searches every topic and files what is new in Market Pulse.
 *
 * Costs nothing per article: the headline, source and snippet come from the
 * feed, so there is no page fetch and no model call. Rows arrive unqueued
 * for any digest and outside News — a search result is a lead, and both of
 * those are decisions for a person.
 *
 * One topic failing does not stop the rest; it is reported.
 */
export async function runNewsDiscovery(): Promise<DiscoveryResult> {
  const result: DiscoveryResult = { created: 0, byTopic: {}, failed: [] }
  const seenThisRun = new Set<string>()

  for (const topic of DISCOVERY_TOPICS) {
    try {
      const found = (await searchTopic(topic.query)).filter((a) => !seenThisRun.has(a.url))
      if (found.length === 0) { result.byTopic[topic.label] = 0; continue }
      const known = await prisma.researchLibraryItem.findMany({
        where: { url: { in: found.map((a) => a.url) } }, select: { url: true },
      })
      const knownUrls = new Set(known.map((k) => k.url))
      const fresh = found.filter((a) => !knownUrls.has(a.url)).slice(0, PER_TOPIC)
      for (const a of fresh) {
        seenThisRun.add(a.url)
        await prisma.researchLibraryItem.create({
          data: {
            url: a.url, ingestionSource: 'discovery', discoveryTopic: topic.label,
            title: a.title, summary: a.description, newsSource: a.source,
            dateFound: a.publishedAt ?? new Date(), status: 'new', digestAudiences: [],
          },
        })
      }
      result.byTopic[topic.label] = fresh.length
      result.created += fresh.length
    } catch (e) {
      console.error('News discovery failed for topic', topic.key, e)
      result.failed.push(topic.label)
    }
  }
  return result
}
