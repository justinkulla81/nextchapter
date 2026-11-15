import { USER_AGENT, parseJobPostingLd, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { worthFetching } from '@/lib/jobs/gov-workday-core'

// Government employers on Oracle Taleo Business Edition career sites (https://<host>/<path>/ats/careers/v2/...): the server-
// rendered job list (10 a page, "next" links, a session cookie) and each job's page, which carries JobPosting JSON-LD.
// No database access here.

export interface TaleoBoard {
  host: string // e.g. phh.tbe.taleo.net
  path: string // e.g. phh04
  org: string
  cws: number
  employer: string
  place: string
}

const base = (b: TaleoBoard) => `https://${b.host}/${b.path}/ats/careers/v2`
export const taleoUrl = (b: TaleoBoard, rid: string) => `${base(b)}/viewRequisition?org=${b.org}&cws=${b.cws}&rid=${rid}`

async function fetchPage(url: string, cookie: string, timeoutMs: number): Promise<{ text: string; cookie: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US', Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}) } })
    if (!res.ok) return null
    const set = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0])
    return { text: await res.text(), cookie: [cookie, ...set].filter(Boolean).join('; ') }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function parseTaleoList(html: string, b: TaleoBoard): BoardPost[] {
  const out: BoardPost[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a[^>]*href="[^"]*viewRequisition\?[^"]*rid=(\d+)[^"]*"[^>]*class="viewJobLink"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!seen.has(m[1]) && title) { seen.add(m[1]); out.push({ key: m[1], title }) }
  }
  void b
  return out
}

export async function listTaleo(b: TaleoBoard, deadline: number): Promise<{ posts: BoardPost[]; complete: boolean }> {
  const posts: BoardPost[] = []
  const seen = new Set<string>()
  let page = await fetchPage(`${base(b)}/searchResults?org=${b.org}&cws=${b.cws}`, '', 30_000)
  for (let n = 0; page && n < 60; n++) {
    if (Date.now() > deadline) return { posts, complete: false }
    const fresh = parseTaleoList(page.text, b).filter((p) => !seen.has(p.key))
    fresh.forEach((p) => { seen.add(p.key); posts.push(p) })
    const next = /href="([^"]*searchResults\?next&(?:amp;)?rowFrom=\d+[^"]*)"/.exec(page.text)?.[1]?.replace(/&amp;/g, '&')
    if (!next || fresh.length === 0) return { posts, complete: true }
    page = await fetchPage(next.startsWith('http') ? next : `https://${b.host}${next}`, page.cookie, 30_000)
  }
  return { posts, complete: page !== null }
}

export async function detailTaleo(b: TaleoBoard, post: BoardPost): Promise<FeedPosting | null> {
  const page = await fetchPage(taleoUrl(b, post.key), '', 30_000)
  const parsed = page ? parseJobPostingLd(page.text) : null
  if (!parsed) return null
  // A Taleo location is often a building ('HR-New Courthouse, Florida'); only a 'City, ST' is used, else the employer's place.
  const own = parsed.location && /,\s*[A-Z]{2}$/.test(parsed.location) ? parsed.location : null
  const location = own ?? b.place
  return { ...parsed, employer: b.employer, location, state: statesFromLocation(location).states[0] ?? parsed.state }
}

export const GOV_TALEO_BOARDS: TaleoBoard[] = [
  { host: 'phh.tbe.taleo.net', path: 'phh04', org: 'PCG', cws: 47, employer: 'Pinellas County', place: 'Pinellas County, FL' },
  { host: 'phe.tbe.taleo.net', path: 'phe02', org: 'CAMBRIDGEMA', cws: 37, employer: 'City of Cambridge, Massachusetts', place: 'Cambridge, MA' },
  { host: 'phg.tbe.taleo.net', path: 'phg02', org: 'VBGOV', cws: 37, employer: 'City of Virginia Beach', place: 'Virginia Beach, VA' },
]

export const taleoAdapter: BoardAdapter<TaleoBoard> = {
  addedBy: 'govtaleo_feed',
  sourceName: 'Taleo',
  boards: GOV_TALEO_BOARDS,
  prefix: (b) => `${base(b)}/viewRequisition?org=${b.org}&cws=${b.cws}&rid=`,
  urlOf: (b, p) => taleoUrl(b, p.key),
  list: listTaleo,
  detail: detailTaleo,
  worth: worthFetching,
}
