import 'server-only'
import { isInternshipJob } from '@/lib/jobs/work-type'
import { prisma } from '@/lib/prisma'
import { featuredFirst } from '@/lib/workforce/featured-jobs'

// Jobs an employer posted for one college's alumni only (ExclusiveJobPosting.institutionScopeId).
// Visible to a member only through a claimed InstitutionMember row of that institution,
// and kept out of every open-board query (see institutionScopeId: null in liveBoardWhere
// and the other board readers).
export async function listAlumniJobs(candidateId: string) {
  const memberships = await prisma.institutionMember.findMany({
    where: { candidateId, status: { in: ['CLAIMED', 'ACTIVE'] } },
    select: { institutionId: true, institution: { select: { name: true, programBrandName: true } } },
  })
  if (memberships.length === 0) return []
  const names = new Map(memberships.map((m) => [m.institutionId, m.institution.programBrandName ?? m.institution.name]))

  const now = new Date()
  const live = { status: 'approved', archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
  const select = { id: true, title: true, companyName: true, location: true, url: true, institutionScopeId: true, createdAt: true, employmentType: true } as const
  // Jobs the organization featured (at most 10 each): the open-board job or its own group listing.
  const featuredRows = await prisma.featuredJob.findMany({ where: { institutionId: { in: [...names.keys()] } }, orderBy: { createdAt: 'desc' }, take: 50, select: { institutionId: true, postingId: true, note: true, createdAt: true } }).catch(() => [])
  const [scoped, featuredPostings] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({ where: { institutionScopeId: { in: [...names.keys()] }, ...live }, orderBy: { createdAt: 'desc' }, take: 100, select }),
    featuredRows.length ? prisma.exclusiveJobPosting.findMany({ where: { id: { in: featuredRows.map((f) => f.postingId) }, ...live }, select }) : Promise.resolve([]),
  ])
  const feat = new Map<string, (typeof featuredRows)[number]>()
  for (const f of featuredRows) if (!feat.has(f.postingId)) feat.set(f.postingId, f)
  const byId = new Map([...scoped, ...featuredPostings].map((p) => [p.id, p]))
  const rows = [...byId.values()].map((p) => {
    const f = feat.get(p.id)
    return { ...p, institutionName: names.get(p.institutionScopeId ?? f?.institutionId ?? '') ?? '', featuredAt: f?.createdAt ?? null, featuredBy: f ? (names.get(f.institutionId) ?? null) : null, featuredNote: f?.note ?? null }
  })
  // Internships are shown only in the college's Higher Ed portal, never on the member dashboard.
  return featuredFirst(rows.filter((p) => !isInternshipJob(p)))
}
