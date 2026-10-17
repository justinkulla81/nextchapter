import 'server-only'
import { prisma } from '@/lib/prisma'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'

export interface SimilarJob {
  id: string
  title: string
  companyName: string
  location: string | null
  confidential: boolean
}

// Three live jobs like a closed one (the "This job just closed" page): same function and
// level, in the same state first, then anywhere; newest first. Fewer than three when the
// board has fewer.
export async function similarLiveJobs(
  job: { id: string; targetFunction: string | null; level: string | null; locationState: string | null },
  take = 3
): Promise<SimilarJob[]> {
  if (!job.targetFunction && !job.level) return []
  const base = {
    id: { not: job.id },
    ...(job.targetFunction ? { targetFunction: job.targetFunction } : {}),
    ...(job.level ? { level: job.level } : {}),
  }
  const select = { id: true, title: true, companyName: true, location: true, disclosure: true } as const
  const near = job.locationState
    ? await prisma.exclusiveJobPosting.findMany({ where: liveBoardWhere({ ...base, locationState: job.locationState }), select, orderBy: { postedAt: 'desc' }, take })
    : []
  const rest =
    near.length < take
      ? await prisma.exclusiveJobPosting.findMany({
          where: liveBoardWhere({ ...base, id: { notIn: [job.id, ...near.map((n) => n.id)] } }),
          select,
          orderBy: { postedAt: 'desc' },
          take: take - near.length,
        })
      : []
  return [...near, ...rest].map((p) => ({ id: p.id, title: p.title, companyName: p.companyName, location: p.location, confidential: p.disclosure === 'CONFIDENTIAL' }))
}
