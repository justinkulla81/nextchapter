// What a college's alumni can follow back on campus, from public sources:
//
// - Research in your field: recent journal articles with at least one author
//   affiliated with the college, from Crossref's public API (no key). Crossref
//   matches affiliations loosely, so every result is kept only if an author's
//   affiliation names the college. Cached 24 hours per server instance.
// - Patents: no free patent API answers without a key, so we link to a Google
//   Patents search for the college and the field, and to the college's own
//   technology-transfer office when its profile names one.
// - Alumni in the news: Google News search results for the college's name with
//   "alumnus", "alumna", "alumni" or "graduate", last four months, cached 6 hours.
//   Found by Google News, not checked by the college; the screen says so.
//
// Nothing about any member is sent: queries are the college's name and a field.

import 'server-only'
import { memoTtl } from '@/lib/db/heavy'
import { decodeEntities } from './grants'

const MAILTO = 'support@launchyournextchapter.com'

export type Paper = { doi: string; title: string; journal: string | null; date: string | null; authors: string[] }

const strip = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

type CrossrefItem = {
  DOI?: string
  title?: string[]
  'container-title'?: string[]
  published?: { 'date-parts'?: number[][] }
  author?: { given?: string; family?: string; affiliation?: { name?: string }[] }[]
}

/** Keeps articles with an author at the college, newest first. Exported for tests. */
export function papersFrom(items: CrossrefItem[], collegeName: string, limit = 8): Paper[] {
  const needle = collegeName.toLowerCase()
  const out: Paper[] = []
  const seen = new Set<string>()
  for (const w of items) {
    if (!w.DOI || seen.has(w.DOI)) continue
    const ours = (w.author ?? []).filter((a) => (a.affiliation ?? []).some((af) => (af.name ?? '').toLowerCase().includes(needle)))
    if (!ours.length) continue
    const title = strip(w.title?.[0] ?? '')
    if (!title) continue
    seen.add(w.DOI)
    const parts = w.published?.['date-parts']?.[0] ?? []
    const date = parts[0] ? [parts[0], String(parts[1] ?? 1).padStart(2, '0'), String(parts[2] ?? 1).padStart(2, '0')].join('-') : null
    out.push({
      doi: w.DOI,
      title,
      journal: w['container-title']?.[0] ? strip(w['container-title'][0]) : null,
      date,
      authors: ours.slice(0, 3).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
    })
  }
  return out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, limit)
}

async function loadPapers(collegeName: string, field: string): Promise<Paper[]> {
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
  const url = new URL('https://api.crossref.org/works')
  url.searchParams.set('query.affiliation', collegeName)
  url.searchParams.set('query.bibliographic', field)
  url.searchParams.set('filter', `from-pub-date:${since},type:journal-article`)
  url.searchParams.set('rows', '100')
  url.searchParams.set('select', 'DOI,title,container-title,published,author')
  url.searchParams.set('mailto', MAILTO)
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`Crossref answered ${res.status}`)
  const body = (await res.json()) as { message?: { items?: CrossrefItem[] } }
  return papersFrom(body.message?.items ?? [], collegeName)
}

const cachedPapers = memoTtl(24 * 60 * 60_000, (name: string, field: string) => `${name}|${field.toLowerCase()}`, loadPapers)

/** Recent research by the college's authors in a field; null when Crossref doesn't answer. */
export async function collegeResearch(collegeName: string, field: string): Promise<Paper[] | null> {
  try {
    return await cachedPapers(collegeName, field)
  } catch (err) {
    console.error('[research-feed] crossref', err)
    return null
  }
}

export function patentsSearchUrl(collegeName: string, field: string): string {
  const u = new URL('https://patents.google.com/')
  u.searchParams.set('assignee', collegeName)
  u.searchParams.set('q', field)
  u.searchParams.set('sort', 'new')
  return u.toString()
}

export type NewsItem = { title: string; source: string | null; date: string | null; url: string }

/** Parses Google News RSS items. Exported for tests. */
export function newsFrom(xml: string, limit = 10): NewsItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
  const field = (s: string, tag: string) => s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? null
  return items
    .map((it) => {
      const source = field(it, 'source')
      let title = strip(field(it, 'title') ?? '')
      // Google appends " - Source" to each title.
      if (source && title.endsWith(` - ${strip(source)}`)) title = title.slice(0, -(` - ${strip(source)}`).length)
      const pub = field(it, 'pubDate')
      const d = pub ? new Date(pub) : null
      return { title, source: source ? strip(source) : null, date: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null, url: strip(field(it, 'link') ?? '') }
    })
    .filter((n) => n.title && n.url.startsWith('https://news.google.com/'))
    .slice(0, limit)
}

// Name variants to search: the full name, and without a trailing "University" or "College" ("Carnegie Mellon").
// Never an abbreviation: "CMU" is also Central Michigan University.
export function newsNames(collegeName: string): string[] {
  const bare = collegeName.replace(/\s+(University|College)$/i, '').trim()
  return [...new Set([collegeName, bare].filter((n) => n.split(/\s+/).length >= 2))]
}

// One search per name variant: Google News honors the date window per query, but not when the variants are OR-ed together.
async function newsSearch(name: string): Promise<NewsItem[]> {
  const url = new URL('https://news.google.com/rss/search')
  url.searchParams.set('q', `${['alumnus', 'alumna', 'alumni', 'graduate'].map((w) => `"${name} ${w}"`).join(' OR ')} when:120d`)
  url.searchParams.set('hl', 'en-US')
  url.searchParams.set('gl', 'US')
  url.searchParams.set('ceid', 'US:en')
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`Google News answered ${res.status}`)
  return newsFrom(await res.text(), 40)
}

async function loadNews(collegeName: string): Promise<NewsItem[]> {
  const lists = await Promise.all(newsNames(collegeName).map(newsSearch))
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)
  const byTitle = new Map<string, NewsItem>()
  for (const n of lists.flat()) if ((!n.date || n.date >= since) && !byTitle.has(n.title.toLowerCase())) byTitle.set(n.title.toLowerCase(), n)
  return [...byTitle.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 10)
}

const cachedNews = memoTtl(6 * 60 * 60_000, (name: string) => name, loadNews)

export async function alumniNews(collegeName: string): Promise<NewsItem[] | null> {
  try {
    return await cachedNews(collegeName)
  } catch (err) {
    console.error('[research-feed] news', err)
    return null
  }
}
