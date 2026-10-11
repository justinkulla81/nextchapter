import 'server-only'
import { prisma } from '@/lib/prisma'

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

  const postings = await prisma.exclusiveJobPosting.findMany({
    where: {
      institutionScopeId: { in: [...names.keys()] },
      status: 'approved',
      archivedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, title: true, companyName: true, location: true, url: true, institutionScopeId: true, createdAt: true },
  })
  return postings.map((p) => ({ ...p, institutionName: names.get(p.institutionScopeId as string) ?? '' }))
}
