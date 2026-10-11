import 'server-only'
import { prisma } from '@/lib/prisma'
import { isBoardPostingLockedForViewer } from '@/lib/jobs/job-board-visibility'
import { computeAiPayPremium, type FunctionPremium } from '@/lib/market/ai-pay-premium'

// Computed from the live board, shared by every member (it is an aggregate, so it carries
// no individual posting). Locked exclusive postings are left out, so the figure never
// depends on something a member cannot see. Cached an hour per server instance.
const TTL_MS = 60 * 60 * 1000
let cache: { at: number; rows: FunctionPremium[] } | null = null

export async function loadAiPayPremium(): Promise<FunctionPremium[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows
  const postings = await prisma.exclusiveJobPosting.findMany({
    where: {
      status: 'approved',
      archivedAt: null,
      institutionScopeId: null,
      distribution: { not: 'EXCLUDED' },
      disclosure: 'OPEN',
      salaryMin: { not: null },
      salaryMax: { not: null },
    },
    select: {
      title: true, description: true, skills: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
      audienceTier: true, source: true,
    },
    take: 60_000,
  })
  const rows = computeAiPayPremium(postings.filter((p) => !isBoardPostingLockedForViewer(p, false)))
  cache = { at: Date.now(), rows }
  return rows
}
