import 'server-only'
import { unstable_cache } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withStatementTimeout } from '@/lib/db/statement-timeout'
import { classifyLocation } from '@/lib/jobs/us-location'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import { isPublicJob, isStaleVerified } from '@/lib/jobs/public-job-page'
import { PUBLIC_JOB_SELECT } from '@/lib/jobs/public-job-page-server'
import { parseScope } from '@/lib/leads/alert-scope'
import { industryRawValues } from '@/lib/seo/topics'

// The homepage job board: an anonymous, unpersonalized search over the same live
// board members see. No fit score, no ranking by who you are — newest first, then
// the words you typed. Personalization needs an account (see the /jobs page).
//
// Reads the narrow BoardLightRow copy (see board-light-rows.ts), then checks the
// handful of rows it returns against ExclusiveJobPosting for the two things the
// copy doesn't carry: disclosure (CONFIDENTIAL listings never show on a public
// page) and the posting URL.

export const PUBLIC_BOARD_PAGE_SIZE = 12
const MAX_WORDS = 5
const OVERFETCH = PUBLIC_BOARD_PAGE_SIZE * 5
/** Longest one board read may run in the database (a state-wide search takes about 4 s on a cold cache). */
const BOARD_STATEMENT_MS = 10_000
/**
 * The match count stops here. An exact count of a broad search (a whole state, or the bare page) is a scan of the board's copy that ran
 * 28 to 79 s (2026-11); reading at most COUNT_CAP + 1 ids in the page's own order stops as soon as it has them, and above the cap the
 * page says "More than 1,000". At or under the cap the count is exact, as before.
 */
export const COUNT_CAP = 1_000

export interface PublicBoardJob {
  id: string
  title: string
  company: string
  location: string | null
  postedAt: string | null
  salaryMin: number | null
  salaryMax: number | null
  url: string
  /** Our public page for the job (/jobs/[id]) when it has one (public-job-page.ts), else null. */
  pagePath: string | null
}

export interface PublicBoardResult {
  total: number
  /** True when more than COUNT_CAP jobs match: `total` is then COUNT_CAP and the page says "More than 1,000". */
  totalCapped?: boolean
  jobs: PublicBoardJob[]
  /** Mobile app paging: the `offset` for the next page, or null when the board has no more rows for this search. */
  nextOffset?: number | null
}

export interface PublicBoardQuery {
  q: string
  loc: string
  remote: boolean
  /** Only jobs posted (or first listed) after this. Used by the saved-search alert emails. */
  since?: Date
  /** Mobile app: only jobs whose listed pay reaches this yearly figure (top or bottom of the range). */
  minPay?: number
  /** Mobile app: rows to skip, for paging. */
  offset?: number
  /** Only these ncrawl seniority levels (BoardLightRow.level), e.g. ['DIRECTOR']. Off by default. */
  levels?: string[]
  /** The caller only wants the jobs, not the match count (the saved-search alerts): skips the count query and returns total 0. */
  skipTotal?: boolean
}

export function cleanPublicQuery(raw: { q?: string | null; loc?: string | null; remote?: string | null }): PublicBoardQuery {
  const clean = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, 100)
  let loc = clean(raw.loc)
  let remote = raw.remote === '1' || raw.remote === 'true'
  if (/^remote$/i.test(loc)) {
    loc = ''
    remote = true
  }
  return { q: clean(raw.q), loc, remote }
}

function publicWhere(query: PublicBoardQuery, industryIds?: string[]): Prisma.BoardLightRowWhereInput {
  const and: Prisma.BoardLightRowWhereInput[] = []
  // A job-page alert ("company:Acme", "title:...", "industry:...", see leads/alert-scope.ts) matches one field, not every word in two.
  const scope = parseScope(query.q)
  if (scope?.kind === 'company') and.push({ companyName: { equals: scope.value, mode: 'insensitive' } })
  else if (scope?.kind === 'title') and.push({ title: { contains: scope.value, mode: 'insensitive' } })
  else if (scope?.kind === 'industry') and.push({ id: { in: industryIds ?? [] } })
  else if (scope?.kind === 'function') and.push({ targetFunction: { equals: scope.value, mode: 'insensitive' } })
  for (const word of scope ? [] : query.q.split(' ').filter(Boolean).slice(0, MAX_WORDS)) {
    and.push({
      OR: [
        { title: { contains: word, mode: 'insensitive' } },
        { companyName: { contains: word, mode: 'insensitive' } },
      ],
    })
  }
  if (query.loc) and.push({ location: { contains: query.loc, mode: 'insensitive' } })
  if (query.remote) {
    and.push({ OR: [{ targetRemotePolicy: 'remote' }, { location: { contains: 'remote', mode: 'insensitive' } }] })
  }
  if (query.minPay) and.push({ OR: [{ salaryMin: { gte: query.minPay } }, { salaryMax: { gte: query.minPay } }] })
  if (query.levels?.length) and.push({ level: { in: query.levels } })
  if (query.since) {
    and.push({ OR: [{ postedAt: { gt: query.since } }, { postedAt: null, createdAt: { gt: query.since } }] })
  }
  return {
    status: 'approved',
    archivedAt: null,
    institutionScopeId: null,
    distribution: 'OPEN',
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    ...(and.length ? { AND: and } : {}),
  }
}

// Industry sits on the posting, not on the board copy: resolve the posting ids first (newest 2,000 is plenty for one day's alert).
async function industryPostingIds(bucket: string): Promise<string[]> {
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { industry: { in: industryRawValues(bucket) } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function searchPublicBoard(query: PublicBoardQuery): Promise<PublicBoardResult> {
  const scope = parseScope(query.q)
  const where = publicWhere(query, scope?.kind === 'industry' ? await industryPostingIds(scope.value) : undefined)
  // Internships live in the Higher Ed portals, not on member surfaces; the copy has no type column, so drop them by title.
  const noIntern: Prisma.BoardLightRowWhereInput = {
    NOT: {
      OR: [
        { title: { contains: 'internship', mode: 'insensitive' } },
        { title: { startsWith: 'intern ', mode: 'insensitive' } },
        { title: { contains: ' intern ', mode: 'insensitive' } },
        { title: { endsWith: ' intern', mode: 'insensitive' } },
      ],
    },
  }
  // Each read gets BOARD_STATEMENT_MS in the database, not the two-minute default: this search scans the board's copy, and one that cannot
  // finish should free its connection (a count or read ran 28 to 79 s on 2026-11 before the cache and this limit).
  const order: Prisma.BoardLightRowOrderByWithRelationInput[] = [{ postedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
  const [counted, rows] = await Promise.all([
    query.skipTotal
      ? Promise.resolve([] as { id: string }[])
      : withStatementTimeout(prisma.boardLightRow.findMany({ where: { AND: [where, noIntern] }, orderBy: order, take: COUNT_CAP + 1, select: { id: true } }), BOARD_STATEMENT_MS),
    withStatementTimeout(
      prisma.boardLightRow.findMany({
        where: { AND: [where, noIntern] },
        orderBy: order,
        skip: query.offset ?? 0,
        take: OVERFETCH, // headroom: non-US and confidential rows are dropped below
        select: { id: true, title: true, companyName: true, location: true, postedAt: true, createdAt: true, salaryMin: true, salaryMax: true },
      }),
      BOARD_STATEMENT_MS,
    ),
  ])
  const capped = counted.length > COUNT_CAP
  const total = Math.min(counted.length, COUNT_CAP)
  if (rows.length === 0) return { total, ...(capped ? { totalCapped: true } : {}), jobs: [], nextOffset: null }

  // The member board drops jobs confidently outside the US (board-shortlist keepRelevant);
  // do the same here. The count can't be filtered in SQL, so it is scaled by the US share
  // of the rows fetched and rounded, and the page says "about".
  const usRows = rows.filter((r) => classifyLocation(r.location) !== 'non_us')

  const [wide, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { id: { in: usRows.map((r) => r.id) }, disclosure: 'OPEN' },
      select: PUBLIC_JOB_SELECT,
    }),
    getConfirmedGhostIds(),
  ])
  const nowMs = Date.now()
  // A job the crawl has not confirmed open within PUBLIC_JOB_VERIFIED_DAYS is dropped: its own page 404s, and the board copy
  // (BoardLightRow) carries no verification date to filter on in SQL. The count is scaled by the share kept, like the US share.
  const stale = new Set(wide.filter((w) => isStaleVerified(w.lastVerifiedAt, nowMs)).map((w) => w.id))
  const freshUsRows = usRows.filter((r) => !stale.has(r.id))
  // Over the cap the figure is the cap itself; below it the exact count is scaled by the share kept, as before.
  const approxTotal = capped ? COUNT_CAP : roundCount(Math.round(total * (freshUsRows.length / rows.length)))
  const urlById = new Map(wide.map((w) => [w.id, w.url]))
  const publicIds = new Set(wide.filter((w) => isPublicJob(w, nowMs, ghosts.has(w.id))).map((w) => w.id))

  const jobs: PublicBoardJob[] = []
  for (const r of freshUsRows) {
    const url = urlById.get(r.id)
    if (!url) continue
    jobs.push({
      id: r.id,
      title: r.title,
      company: r.companyName,
      location: r.location,
      postedAt: (r.postedAt ?? r.createdAt).toISOString(),
      salaryMin: r.salaryMin,
      salaryMax: r.salaryMax,
      url,
      pagePath: publicIds.has(r.id) ? `/jobs/${r.id}` : null,
    })
    if (jobs.length === PUBLIC_BOARD_PAGE_SIZE) break
  }
  const full = jobs.length === PUBLIC_BOARD_PAGE_SIZE
  const last = jobs[jobs.length - 1]
  const consumed = full && last ? rows.findIndex((r) => r.id === last.id) + 1 : rows.length
  const nextOffset = full || rows.length === OVERFETCH ? (query.offset ?? 0) + consumed : null
  return { total: approxTotal, ...(capped ? { totalCapped: true } : {}), jobs, nextOffset }
}

function roundCount(n: number): number {
  if (n < 100) return n
  const step = n < 1000 ? 10 : n < 10000 ? 100 : 1000
  return Math.round(n / step) * step
}

// The count and the newest-first read scan the whole board with title filters; run once per query every five minutes and shared by every
// visitor and crawler, instead of on each request (the bare /jobs page took 14 to 39 seconds under crawl, 2026-10-26).
const cachedSearch = unstable_cache((q: string) => searchPublicBoard(JSON.parse(q) as PublicBoardQuery), ['public-board-search-v1'], { revalidate: 300 })

export function searchPublicBoardCached(query: PublicBoardQuery): Promise<PublicBoardResult> {
  return cachedSearch(JSON.stringify(query))
}
