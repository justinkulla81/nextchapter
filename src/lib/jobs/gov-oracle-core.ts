import { htmlToText, USER_AGENT, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { isUsLocation } from '@/lib/jobs/us-location'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { worthFetching, yearlyPayFrom } from '@/lib/jobs/gov-workday-core'
import { GOV_ORACLE_BOARDS } from '@/lib/jobs/gov-oracle-boards'

// Government employers on Oracle Recruiting Cloud: the public job-list and job-detail REST that each candidate-experience
// site itself uses (https://<host>/hcmRestApi/resources/latest/recruitingCEJobRequisitions). No database access here.

export interface OracleBoard {
  host: string
  site: string // siteNumber, e.g. CX_1001
  employer: string
  place: string
}

interface OracleReq {
  Id: string
  Title?: string
  PostedDate?: string
  PrimaryLocation?: string
  JobSchedule?: string
}

const api = (b: OracleBoard) => `https://${b.host}/hcmRestApi/resources/latest`
const q = (s: string) => encodeURIComponent(s).replace(/%3B/g, ';').replace(/%3D/g, '=').replace(/%2C/g, ',')

async function getJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    return res.ok ? await res.json() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Dallas County titles come as '0000007224.SYSTEM ENGINEER LEAD.INFO TECH - OPERATIONS': requisition number, title, department. */
export function cleanOracleTitle(title: string): string {
  const m = /^\d{5,}\.([^.]+)\./.exec(title)
  return (m ? m[1] : title).trim()
}

export async function listOracle(b: OracleBoard, deadline: number): Promise<{ posts: BoardPost[]; complete: boolean }> {
  const posts: BoardPost[] = []
  let total: number | null = null
  for (let offset = 0; total === null || offset < total; offset += 25) {
    if (Date.now() > deadline) return { posts, complete: false }
    const finder = `findReqs;siteNumber=${b.site},limit=25,offset=${offset},sortBy=POSTING_DATES_DESC`
    let page = null as { items?: { TotalJobsCount?: number; requisitionList?: OracleReq[] }[] } | null
    for (let attempt = 0; attempt < 2 && !page; attempt++) {
      page = (await getJson(`${api(b)}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=${q(finder)}`, 40_000)) as typeof page
    }
    const first = page?.items?.[0]
    if (!first) return { posts, complete: false }
    if (total === null) total = first.TotalJobsCount ?? 0
    const reqs = first.requisitionList ?? []
    if (reqs.length === 0) break
    for (const r of reqs) posts.push({ key: r.Id, title: cleanOracleTitle(r.Title ?? ''), data: r })
  }
  return { posts, complete: true }
}

export async function detailOracle(b: OracleBoard, post: BoardPost): Promise<FeedPosting | null> {
  const r = post.data as OracleReq
  const finder = `ById;Id="${r.Id}",siteNumber=${b.site}`
  const body = (await getJson(`${api(b)}/recruitingCEJobRequisitionDetails?onlyData=true&finder=${q(finder)}`, 40_000)) as
    | { items?: { ExternalDescriptionStr?: string; ExternalResponsibilitiesStr?: string; ExternalQualificationsStr?: string }[] }
    | null
  const d = body?.items?.[0]
  if (!d) return null
  const raw = (r.PrimaryLocation ?? '').replace(/,\s*United States$/, '').replace(/\s+/g, ' ').trim()
  const location = raw && isUsLocation(raw) && statesFromLocation(raw).states.length > 0 ? raw : b.place
  const description = htmlToText([d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr].filter(Boolean).join('\n'))
  const pay = yearlyPayFrom(description)
  const posted = r.PostedDate ? new Date(r.PostedDate) : null
  return {
    title: post.title,
    employer: b.employer,
    location,
    state: statesFromLocation(location).states[0] ?? null,
    description,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: /full/i.test(r.JobSchedule ?? '') ? 'full_time' : /part/i.test(r.JobSchedule ?? '') ? 'part_time' : null,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
  }
}

export const oracleUrl = (b: OracleBoard, key: string) => `https://${b.host}/hcmUI/CandidateExperience/en/sites/${b.site}/job/${key}`

export const oracleAdapter: BoardAdapter<OracleBoard> = {
  addedBy: 'govoracle_feed',
  sourceName: 'Oracle Recruiting',
  boards: GOV_ORACLE_BOARDS,
  prefix: (b) => `https://${b.host}/hcmUI/CandidateExperience/en/sites/${b.site}/job/`,
  urlOf: (b, p) => oracleUrl(b, p.key),
  list: listOracle,
  detail: detailOracle,
  worth: worthFetching,
}
