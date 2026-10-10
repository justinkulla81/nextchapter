import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'

// Alumni networks: a member's colleges and former employers, as communities they can
// choose to join.
//
// Three rules, each enforced here rather than left to the page:
//   OPT-IN    nothing is ever joined automatically; a network is only offered
//   PRIVATE   a member in Confidential Search Mode is never offered one, and never
//             counted in anyone's group — joining a network makes you visible to it
//   FLOOR     a group is not shown, and cannot be joined, until it has at least
//             MIN_CELL_SIZE (5) members, so a network never exposes a handful of
//             identifiable people
//
// "Former employer" means a job that has ended: current employees are not grouped
// (it would reveal who currently works somewhere).

export const MIN_ALUMNI_GROUP = MIN_CELL_SIZE

export type AlumniKind = 'SCHOOL' | 'FORMER_EMPLOYER'

export interface AlumniNetworkOption {
  kind: AlumniKind
  /** School.id or Company.id */
  refId: string
  name: string
  memberCount: number
  joined: boolean
}

interface Counted {
  id: string
  n: number
}

const REAL_MEMBER = `c."confidentialSearchMode" = false AND c."isSystemAccount" = false AND c."isSampleData" = false`

async function schoolCounts(schoolIds: string[]): Promise<Counted[]> {
  if (schoolIds.length === 0) return []
  const rows = await prisma.$queryRawUnsafe<{ id: string; n: bigint }[]>(
    `SELECT e."schoolId" AS id, COUNT(DISTINCT e."candidateId") AS n
       FROM "EducationEntry" e JOIN "CandidateProfile" c ON c.id = e."candidateId"
      WHERE e."schoolId" = ANY($1) AND ${REAL_MEMBER}
      GROUP BY e."schoolId"`,
    schoolIds
  )
  return rows.map((r) => ({ id: r.id, n: Number(r.n) }))
}

async function employerCounts(companyIds: string[]): Promise<Counted[]> {
  if (companyIds.length === 0) return []
  const rows = await prisma.$queryRawUnsafe<{ id: string; n: bigint }[]>(
    `SELECT t."companyId" AS id, COUNT(DISTINCT t."candidateId") AS n FROM (
        SELECT "companyId", "candidateId" FROM "WorkHistoryEntry" WHERE "isCurrent" = false AND "companyId" = ANY($1)
        UNION
        SELECT "companyId", "candidateId" FROM "UndatedEmployment" WHERE "isCurrent" = false AND "companyId" = ANY($1)
      ) t JOIN "CandidateProfile" c ON c.id = t."candidateId"
      WHERE ${REAL_MEMBER}
      GROUP BY t."companyId"`,
    companyIds
  )
  return rows.map((r) => ({ id: r.id, n: Number(r.n) }))
}

export async function getAlumniNetworkOptions(candidateId: string): Promise<AlumniNetworkOption[]> {
  const viewer = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { confidentialSearchMode: true },
  })
  if (!viewer || viewer.confidentialSearchMode) return []

  const [edu, work, undated, memberships] = await Promise.all([
    prisma.educationEntry.findMany({ where: { candidateId, schoolId: { not: null } }, select: { schoolId: true } }),
    prisma.workHistoryEntry.findMany({ where: { candidateId, isCurrent: false, companyId: { not: null } }, select: { companyId: true } }),
    prisma.undatedEmployment.findMany({ where: { candidateId, isCurrent: false, companyId: { not: null } }, select: { companyId: true } }),
    prisma.communityMembership.findMany({
      where: { candidateId, leftAt: null, community: { type: { in: ['SCHOOL', 'FORMER_EMPLOYER'] } } },
      select: { community: { select: { type: true, value: true } } },
    }),
  ])
  const schoolIds = [...new Set(edu.map((e) => e.schoolId!))]
  const companyIds = [...new Set([...work, ...undated].map((w) => w.companyId!))]

  const [sCounts, cCounts, schools, companies] = await Promise.all([
    schoolCounts(schoolIds),
    employerCounts(companyIds),
    prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true, canonicalKey: true } }),
    prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true, canonicalNameNormalized: true } }),
  ])
  const joinedKeys = new Set(memberships.map((m) => `${m.community.type}:${m.community.value}`))

  const options: AlumniNetworkOption[] = []
  for (const s of schools) {
    const n = sCounts.find((c) => c.id === s.id)?.n ?? 0
    if (n >= MIN_ALUMNI_GROUP) {
      options.push({ kind: 'SCHOOL', refId: s.id, name: s.name, memberCount: n, joined: joinedKeys.has(`SCHOOL:${s.canonicalKey}`) })
    }
  }
  for (const c of companies) {
    const n = cCounts.find((x) => x.id === c.id)?.n ?? 0
    if (n >= MIN_ALUMNI_GROUP) {
      options.push({ kind: 'FORMER_EMPLOYER', refId: c.id, name: c.name, memberCount: n, joined: joinedKeys.has(`FORMER_EMPLOYER:${c.canonicalNameNormalized}`) })
    }
  }
  return options.sort((a, b) => b.memberCount - a.memberCount)
}

/** Join an alumni network. Re-checks everything: the page's list is never trusted. */
export async function joinAlumniNetwork(
  candidateId: string,
  kind: AlumniKind,
  refId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const options = await getAlumniNetworkOptions(candidateId)
  const option = options.find((o) => o.kind === kind && o.refId === refId)
  if (!option) {
    return { ok: false, error: "This network isn't available to you yet. Networks open once five members share it." }
  }

  let value: string
  if (kind === 'SCHOOL') {
    const school = await prisma.school.findUnique({ where: { id: refId }, select: { canonicalKey: true } })
    if (!school) return { ok: false, error: 'School not found.' }
    value = school.canonicalKey
  } else {
    const company = await prisma.company.findUnique({ where: { id: refId }, select: { canonicalNameNormalized: true } })
    if (!company) return { ok: false, error: 'Company not found.' }
    value = company.canonicalNameNormalized
  }

  const community = await prisma.community.upsert({
    where: { type_value: { type: kind, value } },
    create: { type: kind, value, label: `${option.name} alumni` },
    update: {},
  })
  await prisma.communityMembership.upsert({
    where: { communityId_candidateId: { communityId: community.id, candidateId } },
    create: { communityId: community.id, candidateId, joinedVia: 'MANUAL', notifiedAt: new Date() },
    // Rejoining after leaving clears the leave.
    update: { leftAt: null, joinedVia: 'MANUAL', notifiedAt: new Date() },
  })
  return { ok: true }
}
