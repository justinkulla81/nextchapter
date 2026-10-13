import 'server-only'
import { prisma } from '@/lib/prisma'
import { audienceOf, meaningfulDeadline, type FundingNotice } from './relevance'
import { matchesOrgKinds, type ApplicantKind, type Eligibility } from './eligibility'

export { nextCloseAmong } from './eligibility'

/**
 * FundingOpportunity reads and writes, by raw SQL.
 *
 * Raw rather than the generated client so every caller can survive the table
 * not existing yet (prisma/manual/funding-opportunities.sql is applied by hand):
 * each function here throws on a missing table and callers decide what to do.
 */

export interface StoredOpportunity {
  id: string
  source: string
  title: string
  kind: string
  audience: 'CUSTOMERS' | 'US'
  eligibility: Exclude<Eligibility, 'NOT_ELIGIBLE'>
  applicantKinds: ApplicantKind[]
  partnerKinds: ApplicantKind[]
  eligibilityNote: string | null
  agency: string
  orgId: string | null
  url: string
  postedAt: Date | null
  closesAt: Date | null
  awardCeiling: number | null
}

const COLUMNS = `"id","source","title","kind","audience","eligibility","applicantKinds","partnerKinds","eligibilityNote","agency","orgId","url","postedAt","closesAt","awardCeiling"`
const DAY = 86_400_000

export async function upsertOpportunities(rows: { notice: FundingNotice; orgId: string | null }[]): Promise<number> {
  let n = 0
  const now = new Date()
  for (const { notice: x, orgId } of rows) {
    if (x.eligibility === 'NOT_ELIGIBLE') continue
    const ext = x.externalId ?? x.id
    await prisma.$executeRaw`
      INSERT INTO "FundingOpportunity"
        ("id","source","externalId","title","kind","audience","eligibility","applicantKinds","partnerKinds","eligibilityNote",
         "agency","orgId","url","state","postedAt","closesAt","awardCeiling")
      VALUES (${`${x.source}:${ext}`}, ${x.source}, ${ext}, ${x.title}, ${x.kind}, ${audienceOf(x.kind)}, ${x.eligibility ?? 'UNKNOWN'},
              ${x.applicantKinds ?? []}::text[], ${x.partnerKinds ?? []}::text[], ${x.eligibilityNote ?? null},
              ${x.agency}, ${orgId}, ${x.url}, ${x.state}, ${x.postedAt}, ${meaningfulDeadline(x, now)}, ${x.awardCeiling ?? null})
      ON CONFLICT ("source","externalId") DO UPDATE SET
        "title" = EXCLUDED."title", "kind" = EXCLUDED."kind", "audience" = EXCLUDED."audience",
        "eligibility" = EXCLUDED."eligibility", "applicantKinds" = EXCLUDED."applicantKinds",
        "partnerKinds" = EXCLUDED."partnerKinds", "eligibilityNote" = EXCLUDED."eligibilityNote",
        "orgId" = COALESCE(EXCLUDED."orgId", "FundingOpportunity"."orgId"),
        "closesAt" = EXCLUDED."closesAt", "awardCeiling" = EXCLUDED."awardCeiling", "lastSeenAt" = CURRENT_TIMESTAMP`
    n++
  }
  return n
}

/** Open (not yet closed) opportunities, soonest close first. Filter in SQL only on what is cheap. */
export async function listOpenOpportunities(opts: { audience?: 'CUSTOMERS' | 'US'; eligibility?: Eligibility; limit?: number; now?: Date } = {}): Promise<StoredOpportunity[]> {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - DAY)
  const rows = await prisma.$queryRawUnsafe<StoredOpportunity[]>(
    `SELECT ${COLUMNS} FROM "FundingOpportunity"
      WHERE ("closesAt" IS NULL OR "closesAt" >= $1)
        AND ($2::text IS NULL OR "audience" = $2)
        AND ($3::text IS NULL OR "eligibility" = $3)
      ORDER BY "closesAt" ASC NULLS LAST, "postedAt" DESC NULLS LAST
      LIMIT $4`,
    cutoff, opts.audience ?? null, opts.eligibility ?? null, opts.limit ?? 200,
  )
  return rows
}

/** The open opportunities an organization of these applicant kinds could apply for, or partner on. */
export async function opportunitiesForKinds(kinds: ApplicantKind[], opts: { limit?: number; now?: Date } = {}): Promise<StoredOpportunity[]> {
  if (kinds.length === 0) return []
  const all = await listOpenOpportunities({ audience: 'CUSTOMERS', now: opts.now, limit: 500 })
  return all.filter((o) => matchesOrgKinds({ eligibility: o.eligibility, kinds: o.applicantKinds }, kinds)).slice(0, opts.limit ?? 20)
}
