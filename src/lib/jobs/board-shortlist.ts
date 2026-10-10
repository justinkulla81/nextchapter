import 'server-only'
import type { ExclusiveJobPosting, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { COMPETITION_SORT_RANK, isFresh, scoreCompetition } from '@/lib/jobs/competition'
import { classifyLocation } from '@/lib/jobs/us-location'
import { ghostRisk, repostKey } from '@/lib/jobs/ghost-risk'
import { getClosedPostingCounts } from '@/lib/jobs/ghost-risk-data'
import { calibratedLevelDistance, calibratedLevelRank } from '@/lib/scoring/level-rank'

type FitCandidate = Parameters<typeof computeBoardListingFitBucket>[0]

/** Jobs a candidate's board can show: approved, live, not excluded, unexpired. */
export function liveBoardWhere(extra: Prisma.ExclusiveJobPostingWhereInput = {}): Prisma.ExclusiveJobPostingWhereInput {
  return {
    status: 'approved',
    archivedAt: null,
    distribution: { not: 'EXCLUDED' },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    // AND, not a spread: an extra OR must not replace the expiry OR above.
    AND: [extra],
  }
}

const LIGHT_SELECT = {
  id: true,
  title: true,
  companyName: true,
  audienceTier: true,
  source: true,
  targetFunction: true,
  targetLevel: true,
  targetRemotePolicy: true,
  targetLocation: true,
  location: true,
  level: true,
  sourceCategory: true,
  postedAt: true,
  sourceCount: true,
  salaryMin: true,
  salaryMax: true,
  createdAt: true,
} satisfies Prisma.ExclusiveJobPostingSelect

const PER_COMPANY = 5

/** Board views: everything, posted in the last 72 hours, or low competition only. */
export type BoardView = 'all' | 'fresh' | 'low_competition'

/** Jobs posted (or, with no posting date, imported) in the last 72 hours. */
export function postedWithinWhere(hours: number): Prisma.ExclusiveJobPostingWhereInput {
  const since = new Date(Date.now() - hours * 3_600_000)
  return { OR: [{ postedAt: { gte: since } }, { postedAt: null, createdAt: { gte: since } }] }
}

export interface BoardShortlist {
  /** Full rows of the best-fitting jobs the candidate can open, best first. */
  open: ExclusiveJobPosting[]
  /** Full rows of the best-fitting Candidate+-only jobs they can't open yet, best first. */
  locked: ExclusiveJobPosting[]
  openTotal: number
  lockedTotal: number
  /** Good-or-better fits the candidate can open, across the whole board: posted in the last 72 hours / low competition. */
  freshOpenTotal: number
  lowCompetitionOpenTotal: number
  /** Live board jobs per company (normalizeOrgName key), across the whole board. */
  countByCompany: Map<string, number>
}

/**
 * The board holds tens of thousands of jobs, so a candidate's view is a
 * shortlist: every live job is ranked by fit on its light fields (no
 * description — the heavy column), and only the best `size` per side
 * (open / locked) are loaded in full. Callers then score those exactly,
 * with description and company size, which is also what keeps the
 * company-size lookup (an LLM call the first time a company is seen)
 * bounded to the jobs actually shown.
 */
export async function loadBoardShortlist(opts: {
  candidate: FitCandidate
  isCandidatePlus: boolean
  where?: Prisma.ExclusiveJobPostingWhereInput
  size?: number
  view?: BoardView
}): Promise<BoardShortlist> {
  const size = opts.size ?? 300
  const closedCounts = await getClosedPostingCounts()
  const nowMs = Date.now()
  // Only relevant jobs reach a member: not confidently outside the US, and not a
  // listing that looks evergreen or fake (see ghost-risk.ts). Excluded rows are kept
  // in the database — this filters the view, it deletes nothing — and the board
  // totals below are computed over what is kept, so they match what is shown.
  const light = (await prisma.exclusiveJobPosting.findMany({ where: liveBoardWhere(opts.where), select: LIGHT_SELECT })).filter(
    (p) => {
      if (classifyLocation(p.location) === 'non_us') return false
      const ghost = ghostRisk({
        priorClosedCount: closedCounts.get(repostKey(p.companyName, p.title, p.location)) ?? 0,
        ageDays: (nowMs - p.createdAt.getTime()) / 86_400_000,
      })
      return ghost.level !== 'likely'
    }
  )

  const countByCompany = new Map<string, number>()
  // Within a fit level, roles nearest the candidate's own level come first
  // (a Director sees Director roles before Manager ones), then newest…
  const candidateLevel =
    opts.candidate.levelRankScore ?? calibratedLevelRank(opts.candidate.highestLevelReached, null)
  // …and, before level, roles in the candidate's own function.
  const functions = new Set(
    [opts.candidate.primaryFunction, opts.candidate.secondaryFunction].filter(Boolean).map((f) => f!.trim().toLowerCase())
  )
  const open: { id: string; rank: number; offFunction: number; crowd: number; gap: number; at: number; company: string; title: string }[] = []
  const locked: typeof open = []
  for (const p of light) {
    const company = p.companyName ? normalizeOrgName(p.companyName) : ''
    if (company) countByCompany.set(company, (countByCompany.get(company) ?? 0) + 1)
  }
  const now = new Date()
  let freshOpenTotal = 0
  let lowCompetitionOpenTotal = 0
  for (const p of light) {
    const company = p.companyName ? normalizeOrgName(p.companyName) : ''
    const canOpen = !isBoardPostingLockedForViewer(p, opts.isCandidatePlus)
    const fresh = isFresh(p, now)
    const competition = scoreCompetition(p, countByCompany.get(company) ?? 0, now).level
    const low = competition === 'low'
    const rank = FIT_BUCKET_SORT_RANK[computeBoardListingFitBucket(opts.candidate, { ...p, description: null })]
    // The prompts count only jobs that fit (strong or good).
    if (canOpen && fresh && rank <= 1) freshOpenTotal++
    if (canOpen && low && rank <= 1) lowCompetitionOpenTotal++
    if (opts.view === 'fresh' && !fresh) continue
    if (opts.view === 'low_competition' && !low) continue
    const entry = {
      id: p.id,
      company,
      title: p.title.trim().toLowerCase(),
      rank,
      crowd: COMPETITION_SORT_RANK[competition],
      offFunction: functions.has((inferFunctionFromTitle(p.title) ?? '').toLowerCase()) ? 0 : 1,
      gap: calibratedLevelDistance(
        candidateLevel,
        calibratedLevelRank(p.targetLevel ?? candidateScaleLevel(p.level) ?? inferLevelFromTitle(p.title), null)
      ),
      at: p.createdAt.getTime(),
    }
    // Everyone can open everything except employer / recruiter exclusives.
    if (!isBoardPostingLockedForViewer(p, opts.isCandidatePlus)) open.push(entry)
    else locked.push(entry)
  }

  // Best fit first, then own function, least competition, nearest level,
  // newest — but one listing per
  // title per company (big employers post the same role in dozens of
  // places) and at most PER_COMPANY per company, so one employer can't fill
  // the whole list. If that leaves room, the held-back ones fill it.
  const best = (list: typeof open) => {
    const sorted = list.sort(
      (a, b) => a.rank - b.rank || a.offFunction - b.offFunction || a.crowd - b.crowd || a.gap - b.gap || b.at - a.at
    )
    const picked: string[] = []
    const heldBack: string[] = []
    const seenTitles = new Set<string>()
    const perCompany = new Map<string, number>()
    for (const e of sorted) {
      if (picked.length >= size) break
      const titleKey = `${e.company}|${e.title}`
      if (seenTitles.has(titleKey)) continue
      seenTitles.add(titleKey)
      const n = perCompany.get(e.company) ?? 0
      if (e.company && n >= PER_COMPANY) {
        if (heldBack.length < size) heldBack.push(e.id)
        continue
      }
      perCompany.set(e.company, n + 1)
      picked.push(e.id)
    }
    return [...picked, ...heldBack].slice(0, size)
  }
  const [openIds, lockedIds] = [best(open), best(locked)]
  const full = new Map(
    (await prisma.exclusiveJobPosting.findMany({ where: { id: { in: [...openIds, ...lockedIds] } } })).map((p) => [p.id, p])
  )
  const inOrder = (ids: string[]) => ids.map((id) => full.get(id)).filter((p): p is ExclusiveJobPosting => !!p)

  return {
    open: inOrder(openIds),
    locked: inOrder(lockedIds),
    openTotal: open.length,
    lockedTotal: locked.length,
    freshOpenTotal,
    lowCompetitionOpenTotal,
    countByCompany,
  }
}
