// Is a board posting still up? The click-time half of the liveness system (the crawler's
// ncrawl/liveness.py re-checks stale jobs daily and 3-hourly; this re-checks the one job a
// member is about to open, when it has not been verified in the last 24 hours).
//
// One fast request (2.5 s budget): Greenhouse / Lever / Workday links go to the ATS's own
// public job API (404 = closed); anything else is fetched once and read the same way the
// crawler reads it — 404/410, a redirect that drops the job's id (the careers home or a
// search page), or "no longer accepting applications" / "position has been filled" text.
// A timeout, a 403/429 or anything unclear is 'unknown', and the member goes through.
//
// Never fetched from here: Jooble (its terms bar fetching jooble.org pages) and Careerjet's
// jobviewtrack.com links (its tracked, pay-per-click click-throughs — a server fetch would
// fake a click). A Jooble job is re-queried through the Jooble partner API when the server
// has JOOBLE_API_KEY; Careerjet's API needs our whitelisted crawler IP, so its jobs rely on
// the crawler's re-queries (every 3 days) and pass through here.

export type LivenessStatus = 'live' | 'dead' | 'unknown'
export interface LivenessResult {
  status: LivenessStatus
  note: string
}

export const VERIFY_FRESH_MS = 24 * 60 * 60 * 1000
export const CLICK_CHECK_TIMEOUT_MS = 2500
const UA = 'NextChapterBot/0.1 (+https://launchyournextchapter.com/bot; jobs-crawler@launchyournextchapter.com)'

const NO_FETCH = /(^|\.)(jooble\.org|jobviewtrack\.com|careerjet\.[a-z.]+|linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|google\.com)$/i

const DEAD_TEXT = new RegExp(
  [
    'no longer (?:accepting applications|accepting applicants|available|open|active|being accepted|posted|exists)',
    '(?:position|job|role|vacancy|requisition) (?:has been|was|is) (?:filled|closed|expired|removed|cancell?ed)',
    'this (?:job|position|posting|role|vacancy|opening|requisition|job posting) (?:has )?(?:expired|closed|is closed|is no longer)',
    '(?:job|posting|position|vacancy) (?:has )?expired',
    'applications? (?:for this (?:job|position|role) )?(?:are|is) (?:now )?closed',
    'job (?:posting )?(?:not found|unavailable|does not exist)',
    "the (?:job|page|position) you(?:'re| are) looking for (?:is no longer|no longer|has been|could not|cannot|can't|does not)",
    'sorry,? (?:this|the) (?:job|position|posting) (?:is|has)',
  ].join('|'),
  'i'
)
const WALL = /(login|signin|sign-in|sso|auth|consent|captcha|challenge)/i
const ID_TOKEN = /(?<![A-Za-z])(\d{4,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|R\d{3,}|JR\d{3,}|REQ\d{3,})/gi
const CLOSED_QUERY = /(closedjob=true|error=true|jobnotfound|job_not_found|expired=|notfound)/i

export type AggregatorKind = 'jooble' | 'careerjet' | null

export function aggregatorKind(url: string): AggregatorKind {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host.endsWith('jooble.org')) return 'jooble'
  if (host.endsWith('jobviewtrack.com') || /(^|\.)careerjet\./.test(host)) return 'careerjet'
  return null
}

/** The ATS's public job API for Greenhouse / Lever / Workday links (they answer 404 once a job closes). */
export function atsApiUrl(url: string): { api: string; kind: 'greenhouse' | 'lever' | 'workday' } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const parts = u.pathname.split('/').filter(Boolean)
  if (host.endsWith('greenhouse.io')) {
    const i = parts.indexOf('jobs')
    if (i >= 1 && /^\d+$/.test(parts[i + 1] ?? '')) return { api: `https://boards-api.greenhouse.io/v1/boards/${parts[i - 1]}/jobs/${parts[i + 1]}`, kind: 'greenhouse' }
  }
  if (host === 'jobs.lever.co' && parts.length >= 2 && /^[0-9a-f-]{36}$/.test(parts[1])) {
    return { api: `https://api.lever.co/v0/postings/${parts[0]}/${parts[1]}`, kind: 'lever' }
  }
  if (host.endsWith('myworkdayjobs.com')) {
    const i = parts.indexOf('job')
    const site = parts.slice(0, Math.max(0, i)).filter((x) => !/^[a-z]{2}-[A-Z]{2}$/.test(x))
    if (i > 0 && site.length > 0) {
      return { api: `https://${host}/wday/cxs/${host.split('.')[0]}/${site[site.length - 1]}/${parts.slice(i).join('/')}`, kind: 'workday' }
    }
  }
  return null
}

function visibleText(html: string): string {
  return html
    .slice(0, 400_000)
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

/** The verdict for one fetched page (pure; shared rules with ncrawl/liveness.py). */
export function classifyPage(input: { url: string; finalUrl: string; status: number; body: string }): LivenessResult {
  const { url, status } = input
  const finalUrl = input.finalUrl || url
  if (status === 404 || status === 410) return { status: 'dead', note: `HTTP ${status}` }
  if (status >= 400) return { status: 'unknown', note: `HTTP ${status}` }
  let orig: URL, fin: URL
  try {
    orig = new URL(url)
    fin = new URL(finalUrl)
  } catch {
    return { status: 'unknown', note: 'bad url' }
  }
  if (CLOSED_QUERY.test(fin.search) && !CLOSED_QUERY.test(orig.search)) return { status: 'dead', note: 'redirected to a closed-job page' }
  if (finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '')) {
    if (WALL.test(fin.hostname + fin.pathname)) return { status: 'unknown', note: 'redirected to a login / consent page' }
    const ids = (orig.pathname + '?' + orig.search).match(ID_TOKEN) ?? []
    if (ids.length > 0 && !ids.some((id) => finalUrl.includes(id))) return { status: 'dead', note: 'redirected away from the job' }
  }
  const m = DEAD_TEXT.exec(visibleText(input.body))
  if (m) return { status: 'dead', note: `page says: ${m[0].slice(0, 80)}` }
  return { status: 'live', note: `HTTP ${status}` }
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms), cache: 'no-store' })
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Jooble partner API: is this title still listed at this place (same company, any id)? */
async function checkJooble(job: { url: string; title: string; companyName: string; location: string | null }, ms: number): Promise<LivenessResult> {
  const key = process.env.JOOBLE_API_KEY
  if (!key) return { status: 'unknown', note: 'Jooble: checked by the crawler only' }
  const id = /\/jdp\/(-?\d+)/.exec(job.url)?.[1]
  const place = (job.location ?? '').split(';')[0].split(',').slice(0, 2).join(',').trim() || 'United States'
  const res = await timedFetch(
    `https://jooble.org/api/${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify({ keywords: job.title, location: place, page: 1, ResultOnPage: 100 }) },
    ms
  )
  if (!res.ok) return { status: 'unknown', note: `Jooble API ${res.status}` }
  const d = (await res.json()) as { totalCount?: number; jobs?: { id?: number | string; title?: string; company?: string }[] }
  const rows = d.jobs ?? []
  if (id && rows.some((j) => String(j.id) === id)) return { status: 'live', note: 'Jooble API: still listed' }
  const t = norm(job.title)
  const c = /confidential/i.test(job.companyName) ? '' : norm(job.companyName)
  const exact = rows.filter((j) => norm(j.title) === t)
  // Same title and company under a new id: the job is up, but this link is the old one.
  if (exact.some((j) => !c || norm(j.company).split(' ')[0] === c.split(' ')[0])) return { status: 'unknown', note: 'Jooble API: listed under a new link' }
  if ((d.totalCount ?? 0) <= rows.length || exact.length < 10) return { status: 'dead', note: 'Jooble API: no longer listed' }
  return { status: 'unknown', note: 'Jooble API: too many results to tell' }
}

/** One liveness check for one posting, within `ms`. Never throws. */
export async function checkPostingLive(
  job: { url: string; title: string; companyName: string; location: string | null },
  ms: number = CLICK_CHECK_TIMEOUT_MS
): Promise<LivenessResult> {
  try {
    const agg = aggregatorKind(job.url)
    if (agg === 'jooble') return await checkJooble(job, ms)
    let host = ''
    try {
      host = new URL(job.url).hostname
    } catch {
      return { status: 'unknown', note: 'bad url' }
    }
    if (agg || NO_FETCH.test(host)) return { status: 'unknown', note: 'not fetched (terms / click tracking / login)' }
    const ats = atsApiUrl(job.url)
    if (ats) {
      const res = await timedFetch(ats.api, { headers: { Accept: 'application/json', 'User-Agent': UA } }, ms)
      if (res.status === 404 || res.status === 410) return { status: 'dead', note: `${ats.kind} API ${res.status}` }
      if (res.status !== 200) return { status: 'unknown', note: `${ats.kind} API ${res.status}` }
      if (ats.kind === 'workday') {
        const d = (await res.json().catch(() => null)) as { jobPostingInfo?: { canApply?: boolean } } | null
        if (d?.jobPostingInfo?.canApply === false) return { status: 'dead', note: 'workday API: canApply false' }
      }
      return { status: 'live', note: `${ats.kind} API 200` }
    }
    const res = await timedFetch(job.url, { redirect: 'follow', headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': UA } }, ms)
    const body = res.status < 400 ? await res.text() : ''
    return classifyPage({ url: job.url, finalUrl: res.url, status: res.status, body })
  } catch (error) {
    const name = (error as { name?: string })?.name
    return { status: 'unknown', note: name === 'TimeoutError' || name === 'AbortError' ? 'timed out' : 'fetch failed' }
  }
}
