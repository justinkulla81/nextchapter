import { htmlToText, USER_AGENT, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { isUsLocation } from '@/lib/jobs/us-location'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { worthFetching, yearlyPayFrom } from '@/lib/jobs/gov-workday-core'

// Government employers on Cornerstone career sites (the Commonwealth of Kentucky): the job search the career site itself
// calls, with a token from the site's own page. The list carries each job's text, so no second request is needed.
// No database access here.

export interface CsodBoard {
  host: string // e.g. kypersonnelcabinet.csod.com
  corp: string // the c= parameter
  siteId: number
  employer: string
  place: string
}

interface CsodReq {
  requisitionId: string
  displayJobTitle?: string
  postingEffectiveDate?: string
  externalDescription?: string
  locations?: { city?: string; state?: string }[]
}

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US', ...(init.headers ?? {}) } })
    return res.ok ? await res.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const csodUrl = (b: CsodBoard, key: string) => `https://${b.host}/ux/ats/careersite/${b.siteId}/home/requisition/${key}?c=${b.corp}`

export async function listCsod(b: CsodBoard, deadline: number): Promise<{ posts: BoardPost[]; complete: boolean }> {
  const home = await request(`https://${b.host}/ux/ats/careersite/${b.siteId}/home?c=${b.corp}`, { headers: { Accept: 'text/html' } }, 30_000)
  const token = home ? /"token"\s*:\s*"([^"]+)"/.exec(home)?.[1] : null
  if (!token) return { posts: [], complete: false }
  const posts: BoardPost[] = []
  let total: number | null = null
  for (let page = 1; total === null || posts.length < total; page++) {
    if (Date.now() > deadline) return { posts, complete: false }
    const body = {
      careerSiteId: b.siteId, careerSitePageId: b.siteId, pageNumber: page, pageSize: 25, cultureId: 1, searchText: '', cultureName: 'en-US',
      states: [], countryCodes: [], cities: [], placeID: '', radius: null, unit: null, postingsWithinDays: null,
      customFieldCheckboxKeys: [], customFieldDropdowns: [], customFieldRadios: [],
    }
    const text = await request('https://us.api.csod.com/rec-job-search/external/jobs', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, 40_000)
    const data = text ? (JSON.parse(text) as { data?: { totalCount?: number; requisitions?: CsodReq[] } }).data : null
    if (!data) return { posts, complete: false }
    if (total === null) total = data.totalCount ?? 0
    const reqs = data.requisitions ?? []
    if (reqs.length === 0) break
    for (const r of reqs) if (r.requisitionId && r.displayJobTitle) posts.push({ key: r.requisitionId, title: r.displayJobTitle.trim(), data: r })
  }
  return { posts, complete: true }
}

export async function detailCsod(b: CsodBoard, post: BoardPost): Promise<FeedPosting | null> {
  const r = post.data as CsodReq
  const first = r.locations?.[0]
  const raw = first ? [first.city, first.state].filter(Boolean).join(', ') : ''
  const location = raw && isUsLocation(raw) && statesFromLocation(raw).states.length > 0 ? raw : b.place
  const description = htmlToText(r.externalDescription ?? '')
  const pay = yearlyPayFrom(description)
  const m = r.postingEffectiveDate ? /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(r.postingEffectiveDate) : null
  const posted = m ? new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]))) : null
  return {
    title: post.title,
    employer: b.employer,
    location,
    state: statesFromLocation(location).states[0] ?? null,
    description,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: null,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
  }
}

export const GOV_CSOD_BOARDS: CsodBoard[] = [
  { host: 'kypersonnelcabinet.csod.com', corp: 'kypersonnelcabinet', siteId: 49, employer: 'Commonwealth of Kentucky', place: 'Kentucky' },
]

export const csodAdapter: BoardAdapter<CsodBoard> = {
  addedBy: 'govcsod_feed',
  sourceName: 'Cornerstone',
  boards: GOV_CSOD_BOARDS,
  prefix: (b) => `https://${b.host}/ux/ats/careersite/${b.siteId}/home/requisition/`,
  urlOf: (b, p) => csodUrl(b, p.key),
  list: listCsod,
  detail: detailCsod,
  worth: worthFetching,
}
