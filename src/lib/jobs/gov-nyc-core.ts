import { htmlToText, USER_AGENT, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { worthFetching } from '@/lib/jobs/gov-workday-core'

// New York City government jobs, from the city's own open-data feed of its job postings (NYC Open Data, dataset kpav-sd4t,
// the Socrata API, no key). Only external postings (open to the public). The feed carries each job's full text, so no
// second request is needed. No database access here.

export const NYC_API = 'https://data.cityofnewyork.us/resource/kpav-sd4t.json'
export const NYC_URL_PREFIX = 'https://a127-jobs.nyc.gov/psc/nycjobs/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_JBPST_FL&Action=U&FOCUS=Applicant&SiteId=1&JobOpeningId='
export const nycUrl = (jobId: string) => `${NYC_URL_PREFIX}${jobId}&PostingSeq=1`

export interface NycRow {
  job_id?: string
  agency?: string
  business_title?: string
  civil_service_title?: string
  full_time_part_time_indicator?: string
  salary_range_from?: string
  salary_range_to?: string
  salary_frequency?: string
  work_location?: string
  job_description?: string
  minimum_qual_requirements?: string
  preferred_skills?: string
  additional_information?: string
  posting_date?: string
  posting_updated?: string
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_m, pre: string, c: string) => pre + c.toUpperCase()).replace(/\bNyc\b/g, 'NYC').replace(/\bDept\b/g, 'Department')

export function nycEmployer(agency: string | undefined): string {
  const a = (agency ?? '').trim()
  return a ? `City of New York, ${titleCase(a)}` : 'City of New York'
}

async function getJson(url: string): Promise<NycRow[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 40_000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    return res.ok ? ((await res.json()) as NycRow[]) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface NycBoard { name: string }

export async function listNyc(_b: NycBoard, deadline: number): Promise<{ posts: BoardPost[]; complete: boolean }> {
  const posts: BoardPost[] = []
  for (let offset = 0; ; offset += 1000) {
    if (Date.now() > deadline) return { posts, complete: false }
    const rows = await getJson(`${NYC_API}?$where=${encodeURIComponent("posting_type='External'")}&$order=job_id&$limit=1000&$offset=${offset}`)
    if (!rows) return { posts, complete: false }
    for (const r of rows) if (r.job_id && r.business_title) posts.push({ key: r.job_id, title: r.business_title.trim(), data: r })
    if (rows.length < 1000) break
  }
  return { posts, complete: true }
}

export async function detailNyc(_b: NycBoard, post: BoardPost): Promise<FeedPosting | null> {
  const r = post.data as NycRow
  const text = [r.job_description, r.minimum_qual_requirements && `Minimum qualifications: ${r.minimum_qual_requirements}`, r.preferred_skills && `Preferred skills: ${r.preferred_skills}`, r.additional_information]
    .filter(Boolean).join('\n\n')
  const yearly = (r.salary_frequency ?? '').toLowerCase() === 'annual'
  const min = Number(r.salary_range_from)
  const max = Number(r.salary_range_to)
  const posted = r.posting_date ? new Date(r.posting_date) : null
  return {
    title: post.title,
    employer: nycEmployer(r.agency),
    location: 'New York, NY',
    state: 'NY',
    description: htmlToText(text),
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: r.full_time_part_time_indicator === 'F' ? 'full_time' : r.full_time_part_time_indicator === 'P' ? 'part_time' : null,
    salaryMin: yearly && min >= 20_000 ? Math.round(min) : null,
    salaryMax: yearly && max >= 20_000 ? Math.round(max) : yearly && min >= 20_000 ? Math.round(min) : null,
  }
}

export const GOV_NYC_BOARDS: NycBoard[] = [{ name: 'New York City' }]

export const nycAdapter: BoardAdapter<NycBoard> = {
  addedBy: 'govnyc_feed',
  sourceName: 'NYC Open Data',
  boards: GOV_NYC_BOARDS,
  prefix: () => NYC_URL_PREFIX,
  urlOf: (_b, p) => nycUrl(p.key),
  list: listNyc,
  detail: detailNyc,
  worth: worthFetching,
}
