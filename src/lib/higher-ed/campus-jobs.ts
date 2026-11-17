// "Work at <college>": the college's own open jobs, first on its alumni job
// board. They come from the jobs NextChapter already reads from employers'
// career sites: the college's employer record (Company) is found by its name,
// plus any extra employer names its profile lists (a school or institute that
// posts under its own name), by the indexed exact normalized name.
//
// The roles are the same cached read a public job page uses for "more roles at
// this employer" (similarJobsAtCompany: live, public, on the employer's own
// career system; kept an hour per instance and 12 hours shared), so this adds
// one small company lookup per college an hour and no job-table reads.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { similarJobsAtCompany, type SimilarJob } from '@/lib/jobs/public-job-page-server'
import { readProfile } from './profile'

export type CampusJob = SimilarJob & { employer: string }

/** The employer names to look up: the college's name and any its profile adds, normalized and de-duplicated. Exported for tests. */
export function employerKeys(collegeName: string, extra: string[] = []): string[] {
  return [...new Set([collegeName, ...extra].map((n) => normalizeOrgName(n)).filter(Boolean))]
}

const companiesFor = memoTtl(60 * 60_000, (institutionId: string) => institutionId, async (institutionId: string) => {
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true, profile: true } })
  if (!inst) return []
  const keys = employerKeys(inst.name, readProfile(inst.profile).college?.employerNames ?? [])
  return prisma.company.findMany({ where: { canonicalNameNormalized: { in: keys } }, select: { id: true, name: true }, take: 10 })
})

/** Up to `limit` live public jobs at the college itself; empty when its employer record has none. */
export async function campusJobs(institutionId: string, limit = 12): Promise<CampusJob[]> {
  try {
    const companies = await companiesFor(institutionId)
    const lists = await Promise.all(companies.map(async (c) => (await similarJobsAtCompany(c.id, '', limit)).map((j) => ({ ...j, employer: c.name }))))
    return lists.flat().slice(0, limit)
  } catch (err) {
    console.error('[campus-jobs]', err)
    return []
  }
}
