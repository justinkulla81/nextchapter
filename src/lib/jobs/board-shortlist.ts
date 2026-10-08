import 'server-only'
import type { ExclusiveJobPosting, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { normalizeOrgName } from '@/lib/text/org-name-match'

type FitCandidate = Parameters<typeof computeBoardListingFitBucket>[0]

/** Jobs a candidate's board can show: approved, live, not excluded, unexpired. */
export function liveBoardWhere(extra: Prisma.ExclusiveJobPostingWhereInput = {}): Prisma.ExclusiveJobPostingWhereInput {
  return {
    status: 'approved',
    archivedAt: null,
    distribution: { not: 'EXCLUDED' },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    ...extra,
  }
}

const LIGHT_SELECT = {
  id: true,
  title: true,
  companyName: true,
  audienceTier: true,
  targetFunction: true,
  targetLevel: true,
  targetRemotePolicy: true,
  targetLocation: true,
  location: true,
  salaryMin: true,
  salaryMax: true,
  createdAt: true,
} satisfies Prisma.ExclusiveJobPostingSelect

export interface BoardShortlist {
  /** Full rows of the best-fitting jobs the candidate can open, newest first. */
  open: ExclusiveJobPosting[]
  /** Full rows of the best-fitting Candidate+-only jobs they can't open yet, newest first. */
  locked: ExclusiveJobPosting[]
  openTotal: number
  lockedTotal: number
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
}): Promise<BoardShortlist> {
  const size = opts.size ?? 300
  const light = await prisma.exclusiveJobPosting.findMany({ where: liveBoardWhere(opts.where), select: LIGHT_SELECT })

  const countByCompany = new Map<string, number>()
  const open: { id: string; rank: number; at: number }[] = []
  const locked: typeof open = []
  for (const p of light) {
    if (p.companyName) {
      const key = normalizeOrgName(p.companyName)
      countByCompany.set(key, (countByCompany.get(key) ?? 0) + 1)
    }
    const entry = {
      id: p.id,
      rank: FIT_BUCKET_SORT_RANK[computeBoardListingFitBucket(opts.candidate, { ...p, description: null })],
      at: p.createdAt.getTime(),
    }
    if (p.audienceTier === 'ALL_CANDIDATES' || opts.isCandidatePlus) open.push(entry)
    else locked.push(entry)
  }

  const best = (list: typeof open) =>
    list
      .sort((a, b) => a.rank - b.rank || b.at - a.at)
      .slice(0, size)
      .map((e) => e.id)
  const [openIds, lockedIds] = [best(open), best(locked)]
  const full = await prisma.exclusiveJobPosting.findMany({
    where: { id: { in: [...openIds, ...lockedIds] } },
    orderBy: { createdAt: 'desc' },
  })
  const lockedSet = new Set(lockedIds)

  return {
    open: full.filter((p) => !lockedSet.has(p.id)),
    locked: full.filter((p) => lockedSet.has(p.id)),
    openTotal: open.length,
    lockedTotal: locked.length,
    countByCompany,
  }
}
