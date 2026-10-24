import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeAiPayPremium, type FunctionPremium } from '@/lib/market/ai-pay-premium'

// Computed from the live board, shared by every member (it is an aggregate, so it carries
// no individual posting). Locked exclusive postings are left out, so the figure never
// depends on something a member cannot see. Cached an hour per server instance.
const TTL_MS = 60 * 60 * 1000
let cache: { at: number; rows: FunctionPremium[] } | null = null

export async function loadAiPayPremium(): Promise<FunctionPremium[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows
  // Descriptions are stored whole now; the AI-skill check reads the first 1,000 characters
  // (the excerpt it was tuned on), clipped in SQL so 60k rows stay a small read.
  const postings = await prisma.$queryRaw<
    { title: string; description: string | null; skills: string[]; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null }[]
  >`
    SELECT "title", left("description", 1000) AS "description", "skills", "salaryMin", "salaryMax", "salaryCurrency"
    FROM public."ExclusiveJobPosting"
    WHERE "status" = 'approved' AND "archivedAt" IS NULL AND "institutionScopeId" IS NULL
      AND "distribution" <> 'EXCLUDED' AND "disclosure" = 'OPEN'
      AND "salaryMin" IS NOT NULL AND "salaryMax" IS NOT NULL
    LIMIT 60000`
  const rows = computeAiPayPremium(postings)
  cache = { at: Date.now(), rows }
  return rows
}
