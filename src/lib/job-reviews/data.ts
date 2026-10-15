import 'server-only'
import { prisma } from '@/lib/prisma'
import { countOwnCultureResponses } from '@/lib/companies/culture-profile'
import { getMatchedAlumniGroups } from '@/lib/network/alumni-groups'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { cleanParallelPaths, cleanReview, answeredCount, type ReviewInput } from '@/lib/job-reviews/constants'

// Past-job reviews, parallel paths and the alumni networks that fall out of a work
// history. Reads are the member's own rows; the only cross-member read is the alumni
// head count, which never names anyone and is shown as "fewer than N" under the floor.

export interface PastJob {
  id: string
  companyName: string
  roleTitle: string
  startDate: Date
  endDate: Date | null
  isCurrent: boolean
  review: ReviewInput | null
}

const toReview = (r: {
  hiredVia: string | null
  workerType: string | null
  employerRating: number | null
  wouldRecommend: string | null
  liked: string[]
  disliked: string[]
}): ReviewInput => ({
  hiredVia: r.hiredVia,
  workerType: r.workerType,
  employerRating: r.employerRating,
  wouldRecommend: r.wouldRecommend,
  liked: r.liked,
  disliked: r.disliked,
})

/** Every job on the member's work history, newest first, with their review when they have written one. */
export async function getPastJobs(candidateId: string): Promise<PastJob[]> {
  const rows = await prisma.workHistoryEntry.findMany({
    where: { candidateId },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      companyName: true,
      roleTitle: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
      review: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    roleTitle: r.roleTitle,
    startDate: r.startDate,
    endDate: r.endDate,
    isCurrent: r.isCurrent,
    review: r.review ? toReview(r.review) : null,
  }))
}

export type SaveReviewResult =
  | { ok: true; answered: number; edited: boolean; companyId: string | null }
  | { ok: false; error: string }

export async function saveJobReview(candidateId: string, workHistoryId: string, raw: unknown): Promise<SaveReviewResult> {
  const entry = await prisma.workHistoryEntry.findFirst({
    where: { id: workHistoryId, candidateId },
    select: { id: true, companyId: true, review: { select: { id: true } } },
  })
  if (!entry) return { ok: false, error: "We couldn't find that job on your work history. Refresh the page and try again." }
  const review = cleanReview(raw)
  const answered = answeredCount(review)
  if (answered === 0) return { ok: false, error: 'Answer at least one question, then save.' }
  const data = { ...review, companyId: entry.companyId }
  await prisma.jobExperienceReview.upsert({
    where: { workHistoryId },
    create: { candidateId, workHistoryId, ...data },
    update: data,
  })
  return { ok: true, answered, edited: entry.review !== null, companyId: entry.companyId }
}

export async function getParallelPaths(candidateId: string): Promise<string[] | null> {
  const row = await prisma.parallelPath.findUnique({ where: { candidateId }, select: { paths: true } })
  return row ? row.paths : null
}

/** An empty list is a real answer: "nothing alongside the search". */
export async function saveParallelPaths(candidateId: string, raw: unknown): Promise<string[]> {
  const paths = cleanParallelPaths(raw)
  await prisma.parallelPath.upsert({ where: { candidateId }, create: { candidateId, paths }, update: { paths } })
  return paths
}

// ── Alumni networks ──────────────────────────────────────────────────────────

export interface AlumniNetwork {
  kind: 'EMPLOYER' | 'SCHOOL'
  name: string
  /** How many other members share this past employer or school; null = under the privacy floor. */
  memberCount: number | null
  /** Company page, when the employer is in the directory. */
  companySlug: string | null
  /** Admin-curated outside alumni group, when one matches. */
  externalUrl: string | null
}

/** Members other than the viewer who are discoverable: not in Confidential Search Mode, not STEALTH, not system or sample accounts. */
const VISIBLE_MEMBER_SQL = `c."confidentialSearchMode" = false AND c."privacyTier" <> 'STEALTH' AND c."isSystemAccount" = false AND c."isSampleData" = false`

/** One alumni network per distinct past employer and school on the member's history. Built from the history itself — no sign-up. */
export async function getAlumniNetworks(candidateId: string): Promise<AlumniNetwork[]> {
  const [work, schools, curated] = await Promise.all([
    prisma.workHistoryEntry.findMany({
      where: { candidateId, isCurrent: false, companyNameNormalized: { not: '' } },
      select: { companyName: true, companyNameNormalized: true, company: { select: { canonicalNameNormalized: true } } },
    }),
    prisma.educationEntry.findMany({ where: { candidateId }, select: { schoolName: true, schoolNameNormalized: true } }),
    getMatchedAlumniGroups(candidateId),
  ])

  const employers = new Map<string, { name: string; slug: string | null }>()
  for (const w of work) if (!employers.has(w.companyNameNormalized)) employers.set(w.companyNameNormalized, { name: w.companyName, slug: w.company?.canonicalNameNormalized ?? null })
  const schoolMap = new Map<string, string>()
  for (const s of schools) if (s.schoolNameNormalized && !schoolMap.has(s.schoolNameNormalized)) schoolMap.set(s.schoolNameNormalized, s.schoolName)

  const [employerCounts, schoolCounts] = await Promise.all([
    employers.size
      ? prisma.$queryRawUnsafe<{ key: string; n: bigint }[]>(
          `SELECT w."companyNameNormalized" AS key, COUNT(DISTINCT w."candidateId") AS n
             FROM "WorkHistoryEntry" w JOIN "CandidateProfile" c ON c."id" = w."candidateId"
            WHERE w."companyNameNormalized" = ANY($1) AND w."candidateId" <> $2 AND ${VISIBLE_MEMBER_SQL}
            GROUP BY 1`,
          [...employers.keys()],
          candidateId
        )
      : [],
    schoolMap.size
      ? prisma.$queryRawUnsafe<{ key: string; n: bigint }[]>(
          `SELECT e."schoolNameNormalized" AS key, COUNT(DISTINCT e."candidateId") AS n
             FROM "EducationEntry" e JOIN "CandidateProfile" c ON c."id" = e."candidateId"
            WHERE e."schoolNameNormalized" = ANY($1) AND e."candidateId" <> $2 AND ${VISIBLE_MEMBER_SQL}
            GROUP BY 1`,
          [...schoolMap.keys()],
          candidateId
        )
      : [],
  ])
  const countFor = (rows: { key: string; n: bigint }[], key: string) => {
    const n = Number(rows.find((r) => r.key === key)?.n ?? 0)
    return n >= MIN_CELL_SIZE ? n : null
  }
  const externalFor = (kind: 'EMPLOYER' | 'SCHOOL', name: string) =>
    curated.find((g) => g.matchType === kind && g.keywords.some((k) => name.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(name.toLowerCase())))?.url ?? null

  return [
    ...[...employers].map(([key, e]) => ({
      kind: 'EMPLOYER' as const,
      name: e.name,
      memberCount: countFor(employerCounts, key),
      companySlug: e.slug,
      externalUrl: externalFor('EMPLOYER', e.name),
    })),
    ...[...schoolMap].map(([key, name]) => ({
      kind: 'SCHOOL' as const,
      name,
      memberCount: countFor(schoolCounts, key),
      companySlug: null,
      externalUrl: externalFor('SCHOOL', name),
    })),
  ]
}

// ── Helpfulness credit ───────────────────────────────────────────────────────

/**
 * How many times the member helped others by rating, reviewing or recommending: a
 * rated or recommended past job, a culture-survey answer, a published company tip.
 * Feeds the labeled tier in the Dossier (src/lib/reports/community-tier.ts); the
 * number itself is never shown outside admin.
 */
export async function countInsightContributions(candidateId: string): Promise<number> {
  const [reviews, culture, intel] = await Promise.all([
    prisma.jobExperienceReview.count({ where: { candidateId, OR: [{ employerRating: { not: null } }, { wouldRecommend: { not: null } }] } }),
    countOwnCultureResponses(candidateId),
    prisma.companyIntel.count({ where: { contributorCandidateId: candidateId, status: 'published' } }),
  ])
  return reviews + culture + intel
}
