import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import {
  PUBLIC_JOB_GHOST_AGE_DAYS,
  PUBLIC_JOB_SITEMAP_SHARDS,
  PUBLIC_JOB_VERIFIED_DAYS,
  isPublicJob,
  type PublicJobRow,
} from '@/lib/jobs/public-job-page'

// Database side of the public job pages (rules: public-job-page.ts).

export const PUBLIC_JOB_SELECT = {
  id: true,
  title: true,
  companyName: true,
  location: true,
  description: true,
  url: true,
  status: true,
  archivedAt: true,
  closeReason: true,
  expiresAt: true,
  lastVerifiedAt: true,
  createdAt: true,
  postedAt: true,
  disclosure: true,
  distribution: true,
  institutionScopeId: true,
  orgScopeId: true,
  source: true,
  employmentType: true,
  locationCountry: true,
  locationState: true,
  locationCity: true,
  workArrangement: true,
  reopenCount: true,
  repostCount: true,
  directListing: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  payPeriod: true,
  externalJobId: true,
  requisitionId: true,
  company: { select: { website: true } },
} satisfies Prisma.ExclusiveJobPostingSelect

/** The job, or null when it has no public page (closed, private, not verified…). One primary-key read. */
export async function getPublicJob(id: string): Promise<PublicJobRow | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null
  const [job, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findUnique({ where: { id }, select: PUBLIC_JOB_SELECT }),
    getConfirmedGhostIds(),
  ])
  if (!job || !isPublicJob(job, Date.now(), ghosts.has(job.id))) return null
  return job
}

// The allowlist's fixed rules — IDENTICAL to the WHERE of the partial index
// "ExclusiveJobPosting_public_page_shard_idx" (prisma/manual/2026-10-22-public-job-pages.sql),
// or the planner won't use it.
const PUBLIC_JOB_STATIC_SQL = Prisma.sql`
  status = 'approved'
  AND "archivedAt" IS NULL
  AND "closeReason" IS NULL
  AND disclosure = 'OPEN'
  AND distribution = 'OPEN'
  AND "institutionScopeId" IS NULL
  AND "orgScopeId" IS NULL
  AND source IN ('ats_feed', 'admin', 'employer', 'recruiter')
  AND length(description) >= 200
  AND ("employmentType" IS NULL OR "employmentType" NOT IN ('internship', 'co_op', 'coop'))
  AND title !~* '\\m(intern|interns|internships?|student trainee)\\M'
  AND ("locationCountry" = 'US' OR ("locationCountry" IS NULL AND "locationState" IS NOT NULL))
  AND COALESCE("reopenCount", 0) < 2
  AND COALESCE("repostCount", 0) < 2`

// The time-dependent rules, applied on top of the index.
const PUBLIC_JOB_LIVE_SQL = Prisma.sql`
  "lastVerifiedAt" > now() - make_interval(days => ${PUBLIC_JOB_VERIFIED_DAYS}::int)
  AND ("expiresAt" IS NULL OR "expiresAt" > now())
  AND ("createdAt" > now() - make_interval(days => ${PUBLIC_JOB_GHOST_AGE_DAYS}::int)
       OR ("directListing" AND COALESCE("reopenCount", 0) = 0 AND COALESCE("repostCount", 0) = 0))
  AND NOT EXISTS (
    SELECT 1 FROM "JobPostingFlag" f WHERE f."postingId" = "ExclusiveJobPosting".id AND f."adminDecision" = 'confirmed_ghost'
  )`

/** One job sitemap file: every public job in shard `shard` (0–15), with its last verification. */
export async function publicJobsInShard(shard: number): Promise<{ id: string; lastVerifiedAt: Date }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  return prisma.$queryRaw<{ id: string; lastVerifiedAt: Date }[]>`
    SELECT id, "lastVerifiedAt" FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND ${PUBLIC_JOB_LIVE_SQL}
    ORDER BY id
    LIMIT 50000`
}

/** Every public job in shard `shard` (0–15) with its dates — the syndication crons' (src/lib/syndication) view of the allowlist. */
export async function publicJobIdsInShard(shard: number): Promise<{ id: string; createdAt: Date; postedAt: Date | null }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  return prisma.$queryRaw<{ id: string; createdAt: Date; postedAt: Date | null }[]>`
    SELECT id, "createdAt", "postedAt" FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND ${PUBLIC_JOB_LIVE_SQL}
    ORDER BY id`
}

/**
 * Full rows for ids from publicJobIdsInShard, re-checked against the allowlist (a job can
 * close between the two reads). The confirmed-ghost rule was already applied in SQL.
 */
export async function publicJobRowsByIds(ids: string[]): Promise<PublicJobRow[]> {
  if (ids.length === 0) return []
  const rows = await prisma.exclusiveJobPosting.findMany({ where: { id: { in: ids } }, select: PUBLIC_JOB_SELECT })
  const now = Date.now()
  return rows.filter((r) => isPublicJob(r, now))
}

/**
 * Public jobs the employer or a recruiter gave us (source 'employer' | 'recruiter') — the
 * employer-authorized subset, for the aggregator feed (src/app/feeds/jobs-employer.xml).
 * Same allowlist as every public page; these sources are few, so no sharding.
 */
export async function publicEmployerJobs(): Promise<PublicJobRow[]> {
  const [rows, ghosts] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: { source: { in: ['employer', 'recruiter'] }, status: 'approved', archivedAt: null, closeReason: null },
      select: PUBLIC_JOB_SELECT,
      orderBy: { id: 'asc' },
      take: 50_000,
    }),
    getConfirmedGhostIds(),
  ])
  const now = Date.now()
  return rows.filter((r) => isPublicJob(r, now, ghosts.has(r.id)))
}
