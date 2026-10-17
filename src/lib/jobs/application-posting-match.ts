// Links a member's application (JobPosting — Gmail-detected, pasted or added by
// hand) to the board posting (ExclusiveJobPosting) it was for, so the admin
// application-fit view can compare the job's stored years requirement and rung
// with the member's. Pure; the DB side is application-posting-link.ts. Tested in
// src/test/application-posting-match.test.ts.
//
// Order — the first step that finds anything decides:
//   1. url            the same posting URL after normalizing: tracking params,
//                     www., trailing slash, and ATS variants (Greenhouse board /
//                     embed / ?gh_jid=, Lever and Ashby /apply, Workday locale
//                     and title slugs, LinkedIn and Indeed job ids) all reduce
//                     to one key.
//   2. ats_id         the same ATS job id or requisition id — from the
//                     application's URL against the posting's externalJobId /
//                     requisitionId / URL. A tenant-scoped id (Workday R-123, a
//                     bare requisition number) also needs the same employer.
//   3. company_title  same employer + same normalized title (the crawler's
//                     normalize_title: req ids, location tails, level numerals
//                     dropped), posted within 60 days before the apply date.
//                     The closest posting date wins.
//   4. none           left unlinked.
//
// Never guesses: when a step finds two or more postings that are different
// roles, the application is left unlinked as 'ambiguous'. Copies of one role
// (the same repostKey or descHash — a repost, or the same opening listed twice)
// are one role, not a choice. Archived / closed postings count: an application
// from three weeks ago often points at a job that has since closed.

import { classifyLocation } from '@/lib/jobs/us-location'

export type PostingMatchMethod = 'url' | 'ats_id' | 'company_title'
export type PostingMatchOutcome = PostingMatchMethod | 'ambiguous' | 'none'

export interface MatchableApplication {
  url: string | null
  title: string | null
  location?: string | null
  /** appliedAt, else when it was added. */
  appliedAt: Date
  /** Directory companies this application's employer resolves to (name, alias or email domain). */
  companyIds: readonly string[]
}

export interface MatchablePosting {
  id: string
  url: string
  title: string
  location?: string | null
  companyId: string | null
  externalJobId?: string | null
  requisitionId?: string | null
  repostKey?: string | null
  descHash?: string | null
  postedAt?: Date | null
  createdAt: Date
  archivedAt?: Date | null
  closeReason?: string | null
}

export interface PostingMatch {
  outcome: PostingMatchOutcome
  postingId: string | null
  /** 0–1. url 0.98, ats_id 0.95 (0.9 tenant-scoped), company_title 0.8 (0.75 when reposts were collapsed). Null when unlinked. */
  confidence: number | null
  /** Postings that tied, for an ambiguous result. */
  candidateIds: string[]
}

export const MATCH_WINDOW_DAYS = 60
/** A posting the crawler first saw up to a day after the member applied (time zones, crawl lag) still counts as "before". */
export const MATCH_GRACE_DAYS = 1
const DAY = 24 * 3600 * 1000

// ── URLs ─────────────────────────────────────────────────────────────────────

/** An ATS's own job id, from a posting or apply URL. `scoped` ids are only unique within one employer. */
export interface AtsJobId {
  ats: string
  id: string
  scoped: boolean
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function parseUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
}

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, '')

export function atsJobIdFromUrl(raw: string | null | undefined): AtsJobId | null {
  const u = parseUrl(raw)
  if (!u) return null
  const host = hostOf(u)
  const path = u.pathname
  const q = u.searchParams

  // Greenhouse: boards.greenhouse.io/acme/jobs/123, job-boards.greenhouse.io/…,
  // boards.greenhouse.io/embed/job_app?for=acme&token=123, or the employer's own
  // careers page carrying ?gh_jid=123. Greenhouse job ids are global.
  const ghJid = q.get('gh_jid')
  if (ghJid && /^\d+$/.test(ghJid)) return { ats: 'greenhouse', id: ghJid, scoped: false }
  if (host.endsWith('greenhouse.io')) {
    const m = path.match(/\/jobs\/(\d+)/)
    if (m) return { ats: 'greenhouse', id: m[1], scoped: false }
    const token = q.get('token')
    if (token && /^\d+$/.test(token)) return { ats: 'greenhouse', id: token, scoped: false }
  }
  // Lever / Ashby: a UUID, with or without /apply or /application.
  if (host.endsWith('lever.co')) {
    const m = path.match(UUID)
    if (m) return { ats: 'lever', id: m[0].toLowerCase(), scoped: false }
  }
  if (host.endsWith('ashbyhq.com')) {
    const m = path.match(UUID)
    if (m) return { ats: 'ashby', id: m[0].toLowerCase(), scoped: false }
  }
  // Workday: acme.wd5.myworkdayjobs.com/[en-US/]Site/job/City/Title_R-12345[/apply]
  // — the trailing requisition id, scoped to the tenant.
  if (host.endsWith('myworkdayjobs.com') || host.endsWith('myworkday.com')) {
    const segs = path.split('/').filter(Boolean)
    const at = segs.indexOf('job')
    const slug = at >= 0 ? segs[segs.length > at + 2 ? at + 2 : segs.length - 1] : undefined
    const id = slug && slug.includes('_') ? slug.slice(slug.lastIndexOf('_') + 1) : null
    if (id && /\d/.test(id)) return { ats: 'workday', id: id.toUpperCase(), scoped: true }
  }
  // SmartRecruiters: jobs.smartrecruiters.com/Acme/743999912345678-title-slug
  if (host.endsWith('smartrecruiters.com')) {
    const m = path.match(/\/(\d{9,})(?:-|\/|$)/)
    if (m) return { ats: 'smartrecruiters', id: m[1], scoped: false }
  }
  // LinkedIn: /jobs/view/123[/…] or ?currentJobId=123. Indeed: ?jk=abc / ?vjk=abc.
  if (host.endsWith('linkedin.com')) {
    const m = path.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/)
    const id = m?.[1] ?? q.get('currentJobId')
    if (id && /^\d+$/.test(id)) return { ats: 'linkedin', id, scoped: false }
  }
  if (host.endsWith('indeed.com')) {
    const id = q.get('jk') ?? q.get('vjk')
    if (id && /^[0-9a-f]{8,}$/i.test(id)) return { ats: 'indeed', id: id.toLowerCase(), scoped: false }
  }
  // Jooble and similar aggregators: /jdp/<id>
  if (host.endsWith('jooble.org')) {
    const m = path.match(/\/jdp\/(-?\d+)/)
    if (m) return { ats: 'jooble', id: m[1], scoped: false }
  }
  return null
}

// Query params that name the job itself, kept by normalizeJobUrl; everything
// else (utm_*, trk, gh_src, source, ref, …) is tracking and dropped.
const ID_PARAMS = new Set(['gh_jid', 'jk', 'vjk', 'currentjobid', 'jobid', 'job_id', 'id', 'token', 'for', 'reqid', 'requisitionid', 'pid', 'jobreq'])

/**
 * One key per posting: the ATS id when the URL has one ("greenhouse:123"),
 * else host + path (+ any job-id params) with tracking params, www., the
 * scheme and a trailing slash or /apply removed. Null for an unusable URL.
 */
export function normalizeJobUrl(raw: string | null | undefined): string | null {
  const u = parseUrl(raw)
  if (!u) return null
  const ats = atsJobIdFromUrl(raw)
  if (ats) return ats.scoped ? `${ats.ats}:${hostOf(u).split('.')[0]}:${ats.id}` : `${ats.ats}:${ats.id}`
  const path = u.pathname.replace(/\/(apply|application)\/?$/i, '').replace(/\/+$/, '').toLowerCase()
  const params = [...u.searchParams.entries()]
    .filter(([k]) => ID_PARAMS.has(k.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}=${v}`)
    .sort()
  return `${hostOf(u)}${path}${params.length ? `?${params.join('&')}` : ''}`
}

// ── Titles ───────────────────────────────────────────────────────────────────

// Port of the crawler's normalize_title (ncrawl/derive.py) — the title half of
// its repost key. 'Sr. Director, FP&A II - Austin, TX (R-12345)' → 'sr director fp a'.
const REQ_ID =
  /\(\s*(req|requisition|job)?\s*(id|#|no\.?)?\s*[:#]?\s*[A-Z]{0,4}[-_]?\d{3,}[A-Z0-9-]*\s*\)|\b(req(uisition)?|job)\s*(id|#|no\.?|number)\s*[:#]?\s*[A-Z0-9-]{3,}|\b[A-Z]{1,4}[-_]?\d{4,}[A-Z0-9-]*\b|#\s*\d{3,}/gi
const LEVEL_SUFFIX = /\b(i{1,3}|iv|v|vi{0,3}|[1-6]|level\s*[1-6]|l[1-6])\s*$/i
const LOC_TAIL_WORDS = /\b(remote|hybrid|on-?site|in-?office|usa?|united states|nationwide|multiple locations)\b/i

function looksLikeLocation(seg: string): boolean {
  const s = seg.trim().replace(/^[\s\-|–—()[\],]+|[\s\-|–—()[\],]+$/g, '')
  if (!s) return false
  if (LOC_TAIL_WORDS.test(s)) return true
  if (/,\s*[A-Z]{2}\b/.test(s)) return true
  return classifyLocation(s) !== 'unknown'
}

export function normalizeJobTitle(title: string | null | undefined): string {
  let t = (title ?? '').replace(/\s+/g, ' ').trim()
  t = t.replace(REQ_ID, ' ')
  for (let i = 0; i < 3; i++) {
    const m = t.match(/\s*(?:[-–—|/]|\bin\b|@)\s*([^-–—|/]+)$/) ?? t.match(/\s*\(([^()]*)\)\s*$/)
    if (m && m.index !== undefined && looksLikeLocation(m[1])) t = t.slice(0, m.index)
    else break
  }
  t = t.replace(/\([^()]*\)/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  return t.replace(LEVEL_SUFFIX, '').trim()
}

// ── Matching ─────────────────────────────────────────────────────────────────

const postingDate = (p: MatchablePosting) => p.postedAt ?? p.createdAt

// Copies of one role — a repost, or the same opening listed twice — share a
// repostKey or descHash. Groups postings into roles (union of both keys).
function roles(postings: MatchablePosting[]): MatchablePosting[][] {
  const parent = postings.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const firstByKey = new Map<string, number>()
  postings.forEach((p, i) => {
    for (const key of [p.repostKey && `r:${p.repostKey}`, p.descHash && `d:${p.descHash}`]) {
      if (!key) continue
      const j = firstByKey.get(key)
      if (j === undefined) firstByKey.set(key, i)
      else parent[find(i)] = find(j)
    }
  })
  const groups = new Map<number, MatchablePosting[]>()
  postings.forEach((p, i) => {
    const r = find(i)
    groups.set(r, [...(groups.get(r) ?? []), p])
  })
  return [...groups.values()]
}

// Within one role, the copy to link: the one closest to the apply date,
// preferring a listing that wasn't archived as someone else's duplicate.
function pickCopy(copies: MatchablePosting[], appliedAt: Date): MatchablePosting {
  return [...copies].sort((a, b) => {
    const dupA = a.closeReason === 'duplicate' ? 1 : 0
    const dupB = b.closeReason === 'duplicate' ? 1 : 0
    if (dupA !== dupB) return dupA - dupB
    const da = Math.abs(appliedAt.getTime() - postingDate(a).getTime())
    const db = Math.abs(appliedAt.getTime() - postingDate(b).getTime())
    return da - db || a.id.localeCompare(b.id)
  })[0]
}

const none = (): PostingMatch => ({ outcome: 'none', postingId: null, confidence: null, candidateIds: [] })

// One role → linked; two or more → ambiguous.
function decide(hits: MatchablePosting[], app: MatchableApplication, method: PostingMatchMethod, confidence: number): PostingMatch {
  const unique = [...new Map(hits.map((h) => [h.id, h])).values()]
  const groups = roles(unique)
  if (groups.length > 1) return { outcome: 'ambiguous', postingId: null, confidence: null, candidateIds: unique.map((h) => h.id).sort() }
  const pick = pickCopy(groups[0], app.appliedAt)
  return { outcome: method, postingId: pick.id, confidence: groups[0].length > 1 && method === 'company_title' ? confidence - 0.05 : confidence, candidateIds: [pick.id] }
}

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The posting this application was for, or why there isn't one. `postings` is
 * every candidate the caller could load (by URL, by id, and the employer's
 * postings) — archived and closed ones included.
 */
export function matchApplicationToPosting(app: MatchableApplication, postings: readonly MatchablePosting[]): PostingMatch {
  if (postings.length === 0) return none()
  const companies = new Set(app.companyIds)
  const sameCompany = (p: MatchablePosting) => !!p.companyId && companies.has(p.companyId)

  // 1. URL
  const appKey = normalizeJobUrl(app.url)
  if (appKey) {
    const hits = postings.filter((p) => normalizeJobUrl(p.url) === appKey)
    if (hits.length) return decide(hits, app, 'url', 0.98)
  }

  // 2. ATS job id / requisition id
  const appAts = atsJobIdFromUrl(app.url)
  if (appAts) {
    const hits = postings.filter((p) => {
      const postAts = atsJobIdFromUrl(p.url)
      const ids = [p.externalJobId, p.requisitionId, postAts?.ats === appAts.ats ? postAts.id : null]
      if (!ids.some((id) => sameText(id, appAts.id))) return false
      // A bare requisition number or a Workday R-id is only unique per employer.
      const globallyUnique = !appAts.scoped && (postAts?.ats === appAts.ats || sameText(p.externalJobId, appAts.id))
      return globallyUnique || sameCompany(p)
    })
    if (hits.length) return decide(hits, app, 'ats_id', appAts.scoped ? 0.9 : 0.95)
  }

  // 3. Same employer + same normalized title, posted in the 60 days before applying.
  const title = normalizeJobTitle(app.title)
  if (!title || companies.size === 0) return none()
  const applied = app.appliedAt.getTime()
  let hits = postings.filter((p) => {
    if (!sameCompany(p) || normalizeJobTitle(p.title) !== title) return false
    const posted = postingDate(p).getTime()
    return posted <= applied + MATCH_GRACE_DAYS * DAY && posted >= applied - MATCH_WINDOW_DAYS * DAY
  })
  if (hits.length === 0) return none()
  // When the member's row knows where the job was, a posting somewhere else isn't a candidate.
  if (app.location && hits.length > 1) {
    const here = hits.filter((p) => sameText(p.location, app.location))
    if (here.length) hits = here
  }
  return decide(hits, app, 'company_title', 0.8)
}
