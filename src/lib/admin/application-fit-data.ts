import 'server-only'
import type { JobPostingSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ttlCached } from '@/lib/admin/ttl-cache'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { parseYearsRequired, type YearsRequirement } from '@/lib/jobs/years-required'
import { classifyTitleRung } from '@/lib/jobs/job-seniority'
import {
  aggregateApplicationFit,
  classifyApplication,
  coachingSuggestion,
  type ApplyFitAggregate,
  type ApplyFitMember,
  type ApplyFitResult,
  type ClassifiedApplication,
} from '@/lib/admin/application-fit'

// Prisma reads for the admin application-fit view (pure logic is in
// application-fit.ts). Everything here goes through an index — the board
// table is ~180k rows and the prod DB has had load trouble, so a page view
// never scans it:
//   applications   JobPosting, paged by id, filtered by appliedAt
//   the job        1. the board card it was applied from (TrackedJob → id)
//                  2. the same URL on the board (ExclusiveJobPosting.url, unique)
//                  3. same company + exact title on the board — company via
//                     Company.canonicalNameNormalized (unique) then
//                     ExclusiveJobPosting.companyId (indexed)
//                  4. the posting text the member pasted (MANUAL rows)
//   member years   yearsExperience, else first work-history start date
// Gmail-detected applications carry only a company and (sometimes) a title,
// so their years requirement is known only when step 3 finds the posting.

const PAGE = 500
const MAX_APPLICATIONS = 10_000

export const SOURCE_LABEL: Record<JobPostingSource, string> = {
  BOARD: 'Board',
  EMAIL_DETECTED: 'Email',
  MANUAL: 'Manual',
}

interface ResolvedJob {
  title: string | null
  level: string | null
  targetLevel: string | null
  yearsRequired: YearsRequirement | null
  /** How the job was found — for the coverage readout. */
  matchedBy: 'board_card' | 'url' | 'company_title' | 'pasted_text' | 'title_only' | 'none'
}

interface MemberRow extends ApplyFitMember {
  id: string
  name: string
  primaryFunction: string | null
}

// For display only — the classifier reads the title itself (levelStep).
function titleRung(title: string | null): string | null {
  if (!title) return null
  const { rung } = classifyTitleRung(title)
  return rung === 'OTHER' ? null : rung
}

const normTitle = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()

async function loadMembers(ids: string[]): Promise<Map<string, MemberRow>> {
  if (ids.length === 0) return new Map()
  const [profiles, firstJobs] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { id: { in: ids }, isSystemAccount: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        highestLevelReached: true,
        levelRankScore: true,
        yearsExperience: true,
        isPivoting: true,
        primaryFunction: true,
      },
    }),
    prisma.workHistoryEntry.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids } }, _min: { startDate: true } }),
  ])
  const firstStart = new Map(firstJobs.map((f) => [f.candidateId, f._min.startDate]))
  const now = Date.now()
  return new Map(
    profiles.map((p) => {
      const start = firstStart.get(p.id)
      const computed = start ? Math.floor((now - start.getTime()) / (365.25 * 24 * 3600 * 1000)) : null
      return [
        p.id,
        {
          id: p.id,
          name: [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed member',
          highestLevelReached: p.highestLevelReached,
          levelRankScore: p.levelRankScore,
          yearsExperience: p.yearsExperience ?? (computed !== null && computed > 0 ? computed : null),
          isPivoting: p.isPivoting,
          primaryFunction: p.primaryFunction,
        },
      ]
    }),
  )
}

type BoardJob = { id: string; title: string; level: string | null; targetLevel: string | null; description: string | null }
const BOARD_JOB_SELECT = { id: true, title: true, level: true, targetLevel: true, description: true } as const

interface AppRow {
  id: string
  candidateId: string
  source: JobPostingSource
  url: string | null
  title: string | null
  companyName: string | null
  extractedText: string | null
  appliedAt: Date | null
  createdAt: Date
  trackedJob: { source: string; sourceId: string } | null
}

// Finds the posting behind each application, in the order described above.
async function resolveJobs(apps: AppRow[]): Promise<Map<string, ResolvedJob>> {
  const out = new Map<string, ResolvedJob>()
  const boardIds = new Set<string>()
  const surfacedIds = new Set<string>()
  for (const a of apps) {
    if (a.trackedJob?.source === 'job_board') boardIds.add(a.trackedJob.sourceId)
    if (a.trackedJob?.source === 'surfaced') surfacedIds.add(a.trackedJob.sourceId)
  }
  const urls = [...new Set(apps.filter((a) => a.url && !a.trackedJob).map((a) => a.url!))]

  const [byId, byUrl, surfaced] = await Promise.all([
    boardIds.size ? prisma.exclusiveJobPosting.findMany({ where: { id: { in: [...boardIds] } }, select: BOARD_JOB_SELECT }) : [],
    urls.length ? prisma.exclusiveJobPosting.findMany({ where: { url: { in: urls } }, select: { ...BOARD_JOB_SELECT, url: true } }) : [],
    surfacedIds.size ? prisma.surfacedJob.findMany({ where: { id: { in: [...surfacedIds] } }, select: { id: true, title: true, description: true } }) : [],
  ])
  const boardById = new Map<string, BoardJob>(byId.map((j) => [j.id, j]))
  const boardByUrl = new Map<string, BoardJob>(byUrl.map((j) => [j.url, j]))
  const surfacedById = new Map(surfaced.map((s) => [s.id, s]))

  const fromBoard = (j: BoardJob, matchedBy: ResolvedJob['matchedBy'], appTitle: string | null): ResolvedJob => ({
    title: j.title || appTitle,
    level: j.level,
    targetLevel: j.targetLevel,
    yearsRequired: parseYearsRequired(j.description),
    matchedBy,
  })

  const needCompany: AppRow[] = []
  for (const a of apps) {
    const tj = a.trackedJob
    const board = tj?.source === 'job_board' ? boardById.get(tj.sourceId) : a.url ? boardByUrl.get(a.url) : undefined
    if (board) {
      out.set(a.id, fromBoard(board, tj ? 'board_card' : 'url', a.title))
      continue
    }
    const s = tj?.source === 'surfaced' ? surfacedById.get(tj.sourceId) : undefined
    if (s) {
      out.set(a.id, { title: s.title, level: null, targetLevel: null, yearsRequired: parseYearsRequired(s.description), matchedBy: 'board_card' })
      continue
    }
    if (a.extractedText) {
      out.set(a.id, { title: a.title, level: null, targetLevel: null, yearsRequired: parseYearsRequired(a.extractedText), matchedBy: 'pasted_text' })
      continue
    }
    if (a.title && a.companyName) needCompany.push(a)
    else out.set(a.id, { title: a.title, level: null, targetLevel: null, yearsRequired: null, matchedBy: a.title ? 'title_only' : 'none' })
  }

  // Same company + exact title on the board, via the two indexed lookups.
  if (needCompany.length) {
    const norms = [...new Set(needCompany.map((a) => normalizeOrgName(a.companyName!)).filter(Boolean))]
    const companies = norms.length
      ? await prisma.company.findMany({ where: { canonicalNameNormalized: { in: norms } }, select: { id: true, canonicalNameNormalized: true } })
      : []
    const companyIdByNorm = new Map(companies.map((c) => [c.canonicalNameNormalized, c.id]))
    const titles = [...new Set(needCompany.map((a) => a.title!.trim()))]
    const matches = companies.length
      ? await prisma.exclusiveJobPosting.findMany({
          where: { companyId: { in: companies.map((c) => c.id) }, title: { in: titles, mode: 'insensitive' } },
          select: { ...BOARD_JOB_SELECT, companyId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        })
      : []
    const byKey = new Map<string, BoardJob>()
    for (const m of matches) {
      const key = `${m.companyId}|${normTitle(m.title)}`
      if (!byKey.has(key)) byKey.set(key, m) // newest first
    }
    for (const a of needCompany) {
      const cid = companyIdByNorm.get(normalizeOrgName(a.companyName!))
      const hit = cid ? byKey.get(`${cid}|${normTitle(a.title!)}`) : undefined
      out.set(a.id, hit ? fromBoard(hit, 'company_title', a.title) : { title: a.title, level: null, targetLevel: null, yearsRequired: null, matchedBy: 'title_only' })
    }
  }
  return out
}

async function loadApplications(where: { since?: Date; candidateId?: string }, max = MAX_APPLICATIONS): Promise<AppRow[]> {
  const rows: AppRow[] = []
  let cursor: string | undefined
  while (rows.length < max) {
    const page = await prisma.jobPosting.findMany({
      where: {
        appliedAt: where.since ? { gte: where.since } : { not: null },
        ...(where.candidateId ? { candidateId: where.candidateId } : { candidate: { isSystemAccount: false } }),
      },
      orderBy: { id: 'asc' },
      take: Math.min(PAGE, max - rows.length),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        candidateId: true,
        source: true,
        url: true,
        title: true,
        companyName: true,
        extractedText: true,
        appliedAt: true,
        createdAt: true,
        trackedJob: { select: { source: true, sourceId: true } },
      },
    })
    rows.push(...page)
    if (page.length < PAGE) break
    cursor = page[page.length - 1].id
  }
  return rows
}

export interface ApplicationFitRow {
  id: string
  candidateId: string
  title: string | null
  companyName: string | null
  date: Date
  source: string
  yearsRequired: YearsRequirement | null
  memberYears: number | null
  jobLevel: string | null
  matchedBy: ResolvedJob['matchedBy']
  result: ApplyFitResult
}

async function classifyRows(apps: AppRow[], members: Map<string, MemberRow>): Promise<ApplicationFitRow[]> {
  const jobs = await resolveJobs(apps)
  const rows: ApplicationFitRow[] = []
  for (const a of apps) {
    const m = members.get(a.candidateId)
    if (!m) continue
    const job = jobs.get(a.id)!
    rows.push({
      id: a.id,
      candidateId: a.candidateId,
      title: job.title ?? a.title,
      companyName: a.companyName,
      date: a.appliedAt ?? a.createdAt,
      source: SOURCE_LABEL[a.source],
      yearsRequired: job.yearsRequired,
      memberYears: m.yearsExperience,
      jobLevel: job.level ?? job.targetLevel ?? titleRung(job.title ?? a.title),
      matchedBy: job.matchedBy,
      result: classifyApplication(m, job),
    })
  }
  return rows
}

// ── Aggregate (admin jobs dashboard) ─────────────────────────────────────────

export type FitWindowDays = 30 | 90

export interface ApplicationFitOverview {
  windowDays: FitWindowDays
  aggregate: ApplyFitAggregate
  memberNames: Record<string, string>
  /** Applications whose job had a parseable years requirement, of all analysed. */
  yearsParsed: number
  /** How each application's job was found. */
  matchedBy: Record<ResolvedJob['matchedBy'], number>
  truncated: boolean
  clicksWithoutApplication: { total: number; reaching: number; on_target: number; underselling: number; unknown: number }
}

async function buildRows(days: FitWindowDays) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)
  const apps = await loadApplications({ since })
  const members = await loadMembers([...new Set(apps.map((a) => a.candidateId))])
  const rows = await classifyRows(apps, members)
  return { rows, members, truncated: apps.length >= MAX_APPLICATIONS, since }
}

// Apply clicks from the board with no application recorded for that job —
// shown separately, never mixed into the application numbers.
async function loadUnconfirmedClicks(since: Date, candidateId?: string) {
  const clicks = await prisma.jobClickEvent.findMany({
    where: { createdAt: { gte: since }, ...(candidateId ? { candidateId } : { candidate: { isSystemAccount: false } }) },
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: { id: true, candidateId: true, source: true, sourceId: true, jobTitle: true, companyName: true, createdAt: true },
  })
  if (clicks.length === 0) return []
  const applied = await prisma.trackedJob.findMany({
    where: { candidateId: { in: [...new Set(clicks.map((c) => c.candidateId))] }, jobPostingId: { not: null } },
    select: { candidateId: true, source: true, sourceId: true },
  })
  const appliedKeys = new Set(applied.map((t) => `${t.candidateId}|${t.source}|${t.sourceId}`))
  const seen = new Set<string>()
  const pending = clicks.filter((c) => {
    const key = `${c.candidateId}|${c.source}|${c.sourceId}`
    if (appliedKeys.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const boardIds = pending.filter((c) => c.source === 'job_board').map((c) => c.sourceId)
  const surfacedIds = pending.filter((c) => c.source === 'surfaced').map((c) => c.sourceId)
  const [board, surfaced, members] = await Promise.all([
    boardIds.length ? prisma.exclusiveJobPosting.findMany({ where: { id: { in: boardIds } }, select: BOARD_JOB_SELECT }) : [],
    surfacedIds.length ? prisma.surfacedJob.findMany({ where: { id: { in: surfacedIds } }, select: { id: true, description: true } }) : [],
    loadMembers([...new Set(pending.map((c) => c.candidateId))]),
  ])
  const boardMap = new Map(board.map((b) => [b.id, b]))
  const surfacedMap = new Map(surfaced.map((s) => [s.id, s]))
  return pending.flatMap((c) => {
    const m = members.get(c.candidateId)
    if (!m) return []
    const b = c.source === 'job_board' ? boardMap.get(c.sourceId) : undefined
    const desc = b?.description ?? surfacedMap.get(c.sourceId)?.description ?? null
    const job = { title: b?.title ?? c.jobTitle, level: b?.level ?? null, targetLevel: b?.targetLevel ?? null, yearsRequired: parseYearsRequired(desc) }
    return [{ id: c.id, candidateId: c.candidateId, title: job.title, companyName: c.companyName, date: c.createdAt, yearsRequired: job.yearsRequired, result: classifyApplication(m, job) }]
  })
}

const cachedOverviewRows = ttlCached(
  10 * 60 * 1000,
  async (days: FitWindowDays) => {
    const { rows, members, truncated, since } = await buildRows(days)
    const clicks = await loadUnconfirmedClicks(since)
    return { rows, members, truncated, clicks }
  },
  (days) => String(days),
)

export async function getApplicationFitOverview(days: FitWindowDays, sortMembersBy: 'reaching' | 'underselling'): Promise<ApplicationFitOverview> {
  const { rows, members, truncated, clicks } = await cachedOverviewRows(days)
  const classified: ClassifiedApplication[] = rows.map((r) => {
    const m = members.get(r.candidateId)
    return { candidateId: r.candidateId, memberLevel: m?.highestLevelReached ?? null, memberFunction: m?.primaryFunction ?? null, result: r.result }
  })
  const aggregate = aggregateApplicationFit(classified, { sortMembersBy })
  const matchedBy = { board_card: 0, url: 0, company_title: 0, pasted_text: 0, title_only: 0, none: 0 }
  for (const r of rows) matchedBy[r.matchedBy]++
  const clickCounts = { total: clicks.length, reaching: 0, on_target: 0, underselling: 0, unknown: 0 }
  for (const c of clicks) clickCounts[c.result.verdict]++
  return {
    windowDays: days,
    aggregate,
    memberNames: Object.fromEntries(aggregate.members.map((m) => [m.candidateId, members.get(m.candidateId)?.name ?? 'Member'])),
    yearsParsed: rows.filter((r) => r.yearsRequired).length,
    matchedBy,
    truncated,
    clicksWithoutApplication: clickCounts,
  }
}

// ── One member (admin candidate page) ────────────────────────────────────────

export interface MemberApplicationFit {
  member: { yearsExperience: number | null; highestLevelReached: string | null; isPivoting: boolean } | null
  rows: ApplicationFitRow[]
  unconfirmedClicks: Awaited<ReturnType<typeof loadUnconfirmedClicks>>
  suggestion: string
}

export async function getMemberApplicationFit(candidateId: string): Promise<MemberApplicationFit> {
  const [apps, members] = await Promise.all([loadApplications({ candidateId }, 300), loadMembers([candidateId])])
  const member = members.get(candidateId) ?? null
  const [rows, unconfirmedClicks] = await Promise.all([
    classifyRows(apps, members),
    loadUnconfirmedClicks(new Date(Date.now() - 90 * 24 * 3600 * 1000), candidateId),
  ])
  rows.sort((a, b) => b.date.getTime() - a.date.getTime())
  return {
    member: member && { yearsExperience: member.yearsExperience, highestLevelReached: member.highestLevelReached, isPivoting: member.isPivoting },
    rows,
    unconfirmedClicks,
    suggestion: coachingSuggestion(rows.map((r) => r.result), member?.isPivoting ?? false),
  }
}
