import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { retryOnPoolTimeout } from '@/lib/db/heavy'
import { employerPath, isCompanyOfferedToSearch } from '@/lib/seo/employer-pages'
import { bucketFromIndustryText, functionByName, functionPath, industryPath } from '@/lib/seo/topics'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'
import {
  PUBLIC_JOB_GHOST_AGE_DAYS,
  PUBLIC_JOB_MIN_INDEX_DESCRIPTION,
  PUBLIC_JOB_SITEMAP_SHARDS,
  PUBLIC_JOB_SOURCES,
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
  postingSignals: true,
  noExperiencePhrase: true,
  trainingPhrase: true,
  externalJobId: true,
  requisitionId: true,
  company: { select: { website: true } },
} satisfies Prisma.ExclusiveJobPostingSelect

/** The job, or null when it has no public page (closed, private, not verified…). One primary-key read. */
export async function getPublicJob(id: string): Promise<PublicJobRow | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null
  const [job, ghosts] = await Promise.all([
    retryOnPoolTimeout(() => prisma.exclusiveJobPosting.findUnique({ where: { id }, select: PUBLIC_JOB_SELECT })),
    retryOnPoolTimeout(() => getConfirmedGhostIds()),
  ])
  if (!job || !isPublicJob(job, Date.now(), ghosts.has(job.id))) return null
  return job
}

// The allowlist's fixed rules — IDENTICAL to the WHERE of the partial index
// "ExclusiveJobPosting_public_page_shard_idx" (prisma/manual/2026-10-22-public-job-pages.sql),
// or the planner won't use it.
export const PUBLIC_JOB_STATIC_SQL = Prisma.sql`
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
export const PUBLIC_JOB_LIVE_SQL = Prisma.sql`
  "lastVerifiedAt" > now() - make_interval(days => ${PUBLIC_JOB_VERIFIED_DAYS}::int)
  AND ("expiresAt" IS NULL OR "expiresAt" > now())
  AND ("createdAt" > now() - make_interval(days => ${PUBLIC_JOB_GHOST_AGE_DAYS}::int)
       OR ("directListing" AND COALESCE("reopenCount", 0) = 0 AND COALESCE("repostCount", 0) = 0))
  AND NOT EXISTS (
    SELECT 1 FROM "JobPostingFlag" f WHERE f."postingId" = "ExclusiveJobPosting".id AND f."adminDecision" = 'confirmed_ghost'
  )`

/**
 * The jobs we ask search engines to take (the sitemap and the pushes to Google and Bing), a smaller set than every public job:
 * the ones that state pay (Google for Jobs shows pay) or are entry-level or need no experience. Every other public job keeps
 * its page and is still found through links; it is just not offered. On 2026-10-26 that was about 45,000 of 176,000 live jobs.
 */
export const PUBLIC_JOB_OFFERED_SQL = Prisma.sql`(
  ("salaryMin" IS NOT NULL AND "payPeriod" IN ('year', 'hour'))
  OR level = 'ENTRY_IC'
  OR 'no_experience_ok' = ANY("postingSignals")
)`

/** One job sitemap file: every public job in shard `shard` (0–15) that is offered to search engines, with its last verification. */
export async function publicJobsInShard(shard: number): Promise<{ id: string; lastVerifiedAt: Date }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  return prisma.$queryRaw<{ id: string; lastVerifiedAt: Date }[]>`
    SELECT id, "lastVerifiedAt" FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
      AND ${PUBLIC_JOB_LIVE_SQL}
      AND ${PUBLIC_JOB_OFFERED_SQL}
    ORDER BY id
    LIMIT 50000`
}

/**
 * Every public job (the page allowlist) in shard `shard` (0–15) with its dates — the syndication crons' (src/lib/syndication)
 * view of it. `offered` says whether it is also one we ask search engines to take; a job that is public but not offered must
 * never be reported to a search engine as gone.
 */
export async function publicJobIdsInShard(shard: number): Promise<{ id: string; createdAt: Date; postedAt: Date | null; offered: boolean }[]> {
  if (!Number.isInteger(shard) || shard < 0 || shard >= PUBLIC_JOB_SITEMAP_SHARDS) return []
  return prisma.$queryRaw<{ id: string; createdAt: Date; postedAt: Date | null; offered: boolean }[]>`
    SELECT id, "createdAt", "postedAt", ${PUBLIC_JOB_OFFERED_SQL} AS offered FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
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
 * Where a job that was public and has since closed should send people (and search engines): its employer's page when that
 * page is offered to search engines, else the function or industry page it was tagged with, else null (a plain 404).
 * A job that never had a public page (private, unverified, unknown) is null too. One primary-key read, plus one more
 * for the employer check; any failure is null, so the page falls back to its 404.
 */
export async function closedJobRedirectTarget(id: string): Promise<string | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null
  try {
    const job = await retryOnPoolTimeout(() =>
      prisma.exclusiveJobPosting.findUnique({
        where: { id },
        select: {
          status: true, archivedAt: true, closeReason: true, expiresAt: true, source: true, disclosure: true, distribution: true,
          institutionScopeId: true, orgScopeId: true, industry: true, targetFunction: true,
          company: { select: { id: true, canonicalNameNormalized: true } },
        },
      }),
    )
    if (!job) return null
    const wasPublic =
      job.status === 'approved' && job.disclosure === 'OPEN' && job.distribution === 'OPEN' && !job.institutionScopeId && !job.orgScopeId &&
      (PUBLIC_JOB_SOURCES as readonly string[]).includes(job.source)
    const closed = !!job.archivedAt || !!job.closeReason || (!!job.expiresAt && job.expiresAt.getTime() < Date.now())
    if (!wasPublic || !closed) return null

    if (job.company && (await isCompanyOfferedToSearch(job.company.id))) return employerPath(job.company.canonicalNameNormalized, job.company.id)
    const fn = functionByName(job.targetFunction)
    if (fn) return functionPath(fn.name)
    const industry = bucketFromIndustryText(job.industry)
    return industry ? industryPath(industry) : null
  } catch {
    return null
  }
}
