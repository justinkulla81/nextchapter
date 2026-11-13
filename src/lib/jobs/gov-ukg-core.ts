import { USER_AGENT, htmlToText, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { worthFetching, yearlyPayFrom } from '@/lib/jobs/gov-workday-core'

// Government employers on UKG Pro Recruiting job boards (recruiting.ultipro.com): the board's own search call (100 jobs a
// page) and each job's page, which holds the description. UKG's robots.txt disallows the search call; the owner chose to
// read it anyway (2026-11-13), as with NEOGOV. The crawler identifies itself and reads a board once a week.
// No database access here.

export interface UkgBoard {
  host: string // recruiting.ultipro.com or recruiting2.ultipro.com
  tenant: string
  guid: string
  employer: string
  place: string
}

interface UkgOpportunity {
  Id: string
  Title?: string
  PostedDate?: string
  FullTime?: boolean
  BriefDescription?: string
  Locations?: { LocalizedName?: string; Address?: { City?: string; State?: { Code?: string } } }[]
}

const root = (b: UkgBoard) => `https://${b.host}/${b.tenant}/JobBoard/${b.guid}`
export const ukgUrl = (b: UkgBoard, id: string) => `${root(b)}/OpportunityDetail?opportunityId=${id}`

async function call(url: string, init: RequestInit, timeoutMs: number): Promise<string | null> {
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

export async function listUkg(b: UkgBoard, deadline: number): Promise<{ posts: BoardPost[]; complete: boolean }> {
  const posts: BoardPost[] = []
  let total: number | null = null
  for (let skip = 0; total === null || skip < total; skip += 100) {
    if (Date.now() > deadline) return { posts, complete: false }
    const body = {
      opportunitySearch: {
        Top: 100, Skip: skip, QueryString: '', OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }],
        Filters: [4, 5, 6].map((fieldName) => ({ t: 'TermsSearchFilterDto', fieldName, extra: null, values: [] })),
      },
      matchCriteria: { PreferredJobs: [], Criteria: [], SearchFilterModel: null },
    }
    const text = await call(`${root(b)}/JobBoardView/LoadSearchResults`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' }, body: JSON.stringify(body) }, 40_000)
    const data = text ? (JSON.parse(text) as { totalCount?: number; opportunities?: UkgOpportunity[] }) : null
    if (!data) return { posts, complete: false }
    if (total === null) total = data.totalCount ?? 0
    const ops = data.opportunities ?? []
    if (ops.length === 0) break
    for (const o of ops) if (o.Id && o.Title) posts.push({ key: o.Id, title: o.Title.trim(), data: o })
  }
  return { posts, complete: true }
}

export function ukgLocation(o: UkgOpportunity): string | null {
  const a = o.Locations?.[0]?.Address
  const s = [a?.City, a?.State?.Code].filter(Boolean).join(', ')
  return s || null
}

export async function detailUkg(b: UkgBoard, post: BoardPost): Promise<FeedPosting | null> {
  const o = post.data as UkgOpportunity
  const page = await call(ukgUrl(b, post.key), { headers: { Accept: 'text/html' } }, 30_000)
  const raw = page ? /"Description":"((?:[^"\\]|\\.){80,})"/.exec(page)?.[1] : null
  let html = ''
  try { html = raw ? (JSON.parse(`"${raw}"`) as string) : '' } catch { html = '' }
  const description = htmlToText(html) || (o.BriefDescription ?? '')
  const own = ukgLocation(o)
  const location = own && statesFromLocation(own).states.length > 0 ? own : b.place
  const pay = yearlyPayFrom(description)
  const posted = o.PostedDate ? new Date(o.PostedDate) : null
  return {
    title: post.title,
    employer: b.employer,
    location,
    state: statesFromLocation(location).states[0] ?? null,
    description,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: o.FullTime === true ? 'full_time' : o.FullTime === false ? 'part_time' : null,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
  }
}

// Government boards found by searching the UKG job-board hosts for city, county and authority employers; each was checked live.
export const GOV_UKG_BOARDS: UkgBoard[] = [
  { host: 'recruiting.ultipro.com', tenant: 'CIT1009CA2', guid: 'f90d5294-f62d-4de2-9878-31193309121c', employer: 'City of Ann Arbor', place: 'Ann Arbor, MI' },
  { host: 'recruiting2.ultipro.com', tenant: 'CIT1029CLO', guid: '1a9f4e7d-ecfd-4986-bc53-146c0831d8b3', employer: 'City of Loveland', place: 'Loveland, CO' },
  { host: 'recruiting2.ultipro.com', tenant: 'CIT1027CITYB', guid: '8fba88c4-597b-42d3-bbc5-216548f2dae4', employer: 'City of Bellevue, Nebraska', place: 'Bellevue, NE' },
  { host: 'recruiting2.ultipro.com', tenant: 'MIN1019MCMC', guid: '1e3cdeef-7cca-47ac-8b4b-e00281b4e2a4', employer: 'McLeod County', place: 'McLeod County, MN' },
  { host: 'recruiting.ultipro.com', tenant: 'TOW1007TWOM', guid: '32bc5b0c-9df6-4869-8f49-3a65c509f9dd', employer: 'Town of Matthews', place: 'Matthews, NC' },
  { host: 'recruiting2.ultipro.com', tenant: 'CIT1031COGV', guid: '9ea09993-abbd-4f01-a39a-02c51151a420', employer: 'City of Greenwood Village', place: 'Greenwood Village, CO' },
  { host: 'recruiting2.ultipro.com', tenant: 'MET1000MNAA', guid: 'e5ff54da-0932-41b2-952c-f2ddf8d2283a', employer: 'Metropolitan Nashville Airport Authority', place: 'Nashville, TN' },
  { host: 'recruiting2.ultipro.com', tenant: 'MIN1014MICCC', guid: '95583d73-4a6d-414c-9be5-fc850746f1b5', employer: 'Mower County', place: 'Mower County, MN' },
  { host: 'recruiting2.ultipro.com', tenant: 'EAG1004EAGC', guid: 'eb55ec73-72d1-4796-b6f2-dbf1b3ef9863', employer: 'Eagle County', place: 'Eagle County, CO' },
  { host: 'recruiting2.ultipro.com', tenant: 'MIN1024MCCOI', guid: '8e955714-b405-4761-a9fc-22fdb6e3763f', employer: 'Isanti County', place: 'Isanti County, MN' },
  { host: 'recruiting.ultipro.com', tenant: 'SOU1036SOUND', guid: 'dcc5dbea-875e-4cd1-bfd2-8e046cecc54f', employer: 'Sound Transit', place: 'Seattle, WA' },
]

export const ukgAdapter: BoardAdapter<UkgBoard> = {
  addedBy: 'govukg_feed',
  sourceName: 'UKG',
  boards: GOV_UKG_BOARDS,
  prefix: (b) => `${root(b)}/OpportunityDetail?opportunityId=`,
  urlOf: (b, p) => ukgUrl(b, p.key),
  list: listUkg,
  detail: detailUkg,
  worth: worthFetching,
}
