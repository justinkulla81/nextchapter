import { decodeEntities, htmlToText, USER_AGENT, type FeedPosting } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'
import { worthFetching } from '@/lib/jobs/gov-workday-core'

// Kentucky school districts' vacancies, from KEPS (Kentucky Education Personnel System, applications.education.ky.gov/KEPs),
// the Department of Education's statewide job site. The search page is an ASP.NET form; one search with every location
// returns the whole table (vacancy id, category, title, posted date, grade level, district, school, subject). Each vacancy's
// page carries the description and the district's address. No database access here.

export const KEPS_SEARCH_URL = 'https://applications.education.ky.gov/KEPs/JobSearch.aspx'
export const KEPS_JOB_PREFIX = 'https://applications.education.ky.gov/KEPs/JobDetails.aspx?vID='

export interface KepsBoard { name: string }

interface KepsRow { category: string; posted: string; grade: string; district: string; school: string; subject: string }

const cell = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

export function parseKepsTable(html: string): BoardPost[] {
  const out: BoardPost[] = []
  for (const tr of html.split(/<tr[\s>]/).slice(1)) {
    const id = /JobDetails\.aspx\?vID=(\d+)/.exec(tr)?.[1]
    if (!id) continue
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => cell(m[1]))
    // [vacancy id, category, title, posted, grade level, district, school(s), subject(s)]
    if (tds.length < 6 || !tds[2]) continue
    out.push({ key: id, title: tds[2], data: { category: tds[1], posted: tds[3], grade: tds[4], district: tds[5], school: tds[6] ?? '', subject: tds[7] ?? '' } satisfies KepsRow })
  }
  return out
}

async function send(url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US', ...(init.headers ?? {}) } })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function listKeps(_b: KepsBoard, _deadline: number): Promise<{ posts: BoardPost[]; complete: boolean }> {
  const first = await send(KEPS_SEARCH_URL, { headers: { Accept: 'text/html' } }, 40_000)
  if (!first?.ok) return { posts: [], complete: false }
  const cookie = (first.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const page = await first.text()
  const fields: Record<string, string> = {}
  for (const m of page.matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)) fields[m[1]] = decodeEntities(m[2])
  const button = /<input[^>]*type="submit"[^>]*name="([^"]*cmdSearchJobs[^"]*)"/.exec(page)?.[1]
  if (!fields.__VIEWSTATE || !button) return { posts: [], complete: false }
  const body = new URLSearchParams({ ...fields, 'ctl00$AppPagePlaceHolder$lbLocations': 'A', 'ctl00$AppPagePlaceHolder$rblPostedDuration': 'A', [button]: 'Search' })
  const res = await send(KEPS_SEARCH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: KEPS_SEARCH_URL, Cookie: cookie, Accept: 'text/html' }, body: body.toString() }, 90_000)
  if (!res?.ok) return { posts: [], complete: false }
  const posts = parseKepsTable(await res.text())
  return { posts, complete: posts.length > 0 }
}

export async function detailKeps(_b: KepsBoard, post: BoardPost): Promise<FeedPosting | null> {
  const row = post.data as KepsRow
  const res = await send(`${KEPS_JOB_PREFIX}${post.key}`, { headers: { Accept: 'text/html' } }, 30_000)
  if (!res?.ok) return null
  const page = await res.text()
  const i = page.indexOf('Job Details')
  const text = htmlToText(page.slice(i >= 0 ? i : 0).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ''))
  const addr = /Organization Address\s*([\s\S]*?)(?:Job Details|$)/.exec(htmlToText(page))?.[1] ?? ''
  const cs = /([A-Za-z.' -]+),\s*KY\s*\d{5}/.exec(addr)
  const city = cs ? cs[1].trim().split(/\s{2,}/).pop()!.replace(/^.*\d\s+/, '').trim() : ''
  const location = city ? `${city}, KY` : 'Kentucky'
  const posted = row.posted ? new Date(row.posted) : null
  const district = row.district.replace(/\s*\(KDE\)$/, '')
  return {
    title: post.title,
    employer: /Department of Education/i.test(district) ? district : `${district} ${/schools?$/i.test(district) ? '' : 'Schools'}`.trim(),
    location,
    state: 'KY',
    description: [row.category && `Position category: ${row.category}`, row.grade && `Grade level: ${row.grade}`, row.school && `School: ${row.school}`, row.subject && `Subject: ${row.subject}`, text].filter(Boolean).join('\n'),
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
  }
}

export const GOV_KEPS_BOARDS: KepsBoard[] = [{ name: 'Kentucky school districts' }]

export const kepsAdapter: BoardAdapter<KepsBoard> = {
  addedBy: 'govkeps_feed',
  sourceName: 'KEPS',
  boards: GOV_KEPS_BOARDS,
  prefix: () => KEPS_JOB_PREFIX,
  urlOf: (_b, p) => `${KEPS_JOB_PREFIX}${p.key}`,
  list: listKeps,
  detail: detailKeps,
  worth: worthFetching,
}
