import { screenImportedJob } from '@/lib/jobs/import-screen'
import { isUsLocation } from '@/lib/jobs/us-location'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { decodeEntities, htmlToText, USER_AGENT, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import { isRelevantTitle } from '@/lib/jobs/gov-titles'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { GOV_WORKDAY_BOARDS } from '@/lib/jobs/gov-workday-boards'

// Government employers on Workday: the public job-list and job-detail JSON that each Workday career site itself uses
// (https://<tenant>.<server>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs). Their robots.txt allows the career site.
// No database access here.

export interface WorkdayBoard {
  host: string // tenant and server, e.g. 'calvertcountymd.wd1'
  site: string
  employer: string
  place: string
}

export interface WorkdayListing { title: string; externalPath: string; locationsText: string }

export const boardOrigin = (b: WorkdayBoard) => `https://${b.host}.myworkdayjobs.com`
export const boardPrefix = (b: WorkdayBoard) => `${boardOrigin(b)}/${b.site}/`
export const jobUrl = (b: WorkdayBoard, externalPath: string) => `${boardOrigin(b)}/${b.site}${externalPath}`
const tenantOf = (b: WorkdayBoard) => b.host.split('.')[0]

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) } })
    return res.ok ? await res.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Every open job of a board, 20 at a time; `complete` is false when the list could not be read to the end. */
export async function listBoard(b: WorkdayBoard, deadline: number): Promise<{ posts: WorkdayListing[]; complete: boolean }> {
  const api = `${boardOrigin(b)}/wday/cxs/${tenantOf(b)}/${b.site}/jobs`
  const posts: WorkdayListing[] = []
  let total: number | null = null
  for (let offset = 0; total === null || offset < total; offset += 20) {
    if (Date.now() > deadline) return { posts, complete: false }
    let page = null as { total?: number; jobPostings?: WorkdayListing[] } | null
    for (let attempt = 0; attempt < 2 && !page; attempt++) {
      page = (await request(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: '' }) }, 20_000)) as typeof page
    }
    if (!page) return { posts, complete: false }
    if (total === null) total = page.total ?? 0 // Workday reports the total on the first page only
    const got = page.jobPostings ?? []
    if (got.length === 0) break
    posts.push(...got)
  }
  return { posts, complete: true }
}

/** Titles worth fetching: a professional or management role that the board's import screen would also keep. */
export function worthFetching(title: string): boolean {
  return isRelevantTitle(title) && screenImportedJob(title, 'United States').keep
}

const YEARLY_RANGE = /\$\s?([\d,]{5,9}(?:\.\d+)?)\s*(?:-|–|to)\s*\$?\s?([\d,]{5,9}(?:\.\d+)?)/i

export function yearlyPayFrom(text: string): { min: number; max: number } | null {
  const m = YEARLY_RANGE.exec(text)
  if (!m) return null
  const min = Number(m[1].replace(/,/g, ''))
  const max = Number(m[2].replace(/,/g, ''))
  return min >= 25_000 && max >= min && max <= 900_000 ? { min: Math.round(min), max: Math.round(max) } : null
}

/** A job's detail as a posting, or null when the page could not be read. */
export async function fetchDetail(b: WorkdayBoard, post: WorkdayListing): Promise<FeedPosting | null> {
  const body = (await request(`${boardOrigin(b)}/wday/cxs/${tenantOf(b)}/${b.site}${post.externalPath}`, { method: 'GET' }, 20_000)) as
    | { jobPostingInfo?: { title?: string; jobDescription?: string; location?: string; startDate?: string; timeType?: string } }
    | null
  const info = body?.jobPostingInfo
  if (!info?.title) return null
  const rawLocation = (info.location || post.locationsText || '').trim()
  const own = rawLocation && isUsLocation(rawLocation) && statesFromLocation(rawLocation).states.length > 0 ? rawLocation : null
  const location = own ?? b.place
  const description = htmlToText(info.jobDescription ?? '')
  const pay = yearlyPayFrom(description)
  const posted = info.startDate ? new Date(info.startDate) : null
  return {
    title: decodeEntities(info.title).trim(),
    employer: b.employer,
    location,
    state: statesFromLocation(location).states[0] ?? null,
    description,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: /full/i.test(info.timeType ?? '') ? 'full_time' : /part/i.test(info.timeType ?? '') ? 'part_time' : null,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
  }
}

/** The Workday boards as an adapter for the shared weekly runner. */
export const workdayAdapter: BoardAdapter<WorkdayBoard> = {
  addedBy: 'govworkday_feed',
  sourceName: 'Workday',
  boards: GOV_WORKDAY_BOARDS,
  prefix: boardPrefix,
  urlOf: (b, p) => jobUrl(b, p.key),
  list: async (b, deadline) => {
    const { posts, complete } = await listBoard(b, deadline)
    return { posts: posts.map((p) => ({ key: p.externalPath, title: p.title, data: p })), complete }
  },
  detail: (b, p) => fetchDetail(b, p.data as WorkdayListing),
  worth: worthFetching,
}
