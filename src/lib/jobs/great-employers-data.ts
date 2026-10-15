import 'server-only'
import { prisma } from '@/lib/prisma'
import type { GreatSets } from '@/lib/jobs/great-employers'
import { parseBenefits, type JobBenefits } from '@/lib/jobs/benefits'

// Reads for the board's "Great pay" / "Great benefits" filters and badges.
//
// ExclusiveJobPosting.benefits / benefitsStrong are @ignore'd in the Prisma
// schema (a full-row read must never select a column the database may not have
// yet), so they are read and written here with raw SQL, and only once the
// columns exist (prisma/manual/2026-10-14-job-benefits.sql). Until then every
// read is empty and every write is skipped: the board and the import work as
// before.
//
// The id sets are small (a few thousand live jobs each) and read through two
// partial indexes from the same file. Without an index the read would scan the
// wide table (~11 s), so a missing index means an empty set, not a slow board.

const TTL_MS = 10 * 60_000

function memo<T>(load: () => Promise<T>, fallback: T): () => Promise<T> {
  let hit: { at: number; value: Promise<T> } | null = null
  return () => {
    if (!hit || Date.now() - hit.at > TTL_MS) {
      const value = load().catch((error) => {
        console.error('great-employers: load failed', error)
        return fallback
      })
      hit = { at: Date.now(), value }
    }
    return hit.value
  }
}

const ABOVE_MARKET_INDEX = 'ExclusiveJobPosting_above_market_live_idx'
const STRONG_BENEFITS_INDEX = 'ExclusiveJobPosting_strong_benefits_live_idx'

interface Schema {
  benefitsColumns: boolean
  indexes: Set<string>
}

const loadSchema = memo<Schema>(async () => {
  const [cols, idx] = await Promise.all([
    prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'ExclusiveJobPosting' AND column_name IN ('benefits', 'benefitsStrong')`,
    prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'ExclusiveJobPosting' AND indexname IN (${ABOVE_MARKET_INDEX}, ${STRONG_BENEFITS_INDEX})`,
  ])
  return { benefitsColumns: cols[0]?.n === 2, indexes: new Set(idx.map((r) => r.indexname)) }
}, { benefitsColumns: false, indexes: new Set() })

/** Whether ExclusiveJobPosting has the benefits columns yet. */
export async function benefitsColumnsReady(): Promise<boolean> {
  return (await loadSchema()).benefitsColumns
}

/** Normalized names of companies whose posted pay runs above market (~450). */
export const loadPayHighCompanies = memo<ReadonlySet<string>>(async () => {
  const rows = await prisma.companyHiringProfile.findMany({
    where: { payLevel: 'high' },
    select: { company: { select: { canonicalNameNormalized: true } } },
  })
  return new Set(rows.map((r) => r.company.canonicalNameNormalized))
}, new Set())

const loadAboveMarketIds = memo<ReadonlySet<string>>(async () => {
  if (!(await loadSchema()).indexes.has(ABOVE_MARKET_INDEX)) return new Set()
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "ExclusiveJobPosting" WHERE "payVsMarket" = 'above' AND "archivedAt" IS NULL`
  return new Set(rows.map((r) => r.id))
}, new Set())

const loadStrongBenefitsIds = memo<ReadonlySet<string>>(async () => {
  const schema = await loadSchema()
  if (!schema.benefitsColumns || !schema.indexes.has(STRONG_BENEFITS_INDEX)) return new Set()
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "ExclusiveJobPosting" WHERE "benefitsStrong" = true AND "archivedAt" IS NULL`
  return new Set(rows.map((r) => r.id))
}, new Set())

/** Everything the board's great-pay / great-benefits filter needs. */
export async function loadGreatSets(): Promise<GreatSets> {
  const [payHighCompanies, aboveMarketJobIds, strongBenefitsJobIds] = await Promise.all([
    loadPayHighCompanies(),
    loadAboveMarketIds(),
    loadStrongBenefitsIds(),
  ])
  return { payHighCompanies, aboveMarketJobIds, strongBenefitsJobIds }
}

/** Structured benefits for the jobs shown (a few hundred ids at most); empty until the columns exist. */
export async function loadJobBenefits(ids: string[]): Promise<Map<string, { benefits: JobBenefits | null; strong: boolean }>> {
  const out = new Map<string, { benefits: JobBenefits | null; strong: boolean }>()
  if (ids.length === 0 || !(await benefitsColumnsReady())) return out
  try {
    const rows = await prisma.$queryRaw<{ id: string; benefits: unknown; benefitsStrong: boolean | null }[]>`
      SELECT "id", "benefits", "benefitsStrong" FROM "ExclusiveJobPosting"
      WHERE "id" = ANY(${ids}::text[]) AND ("benefits" IS NOT NULL OR "benefitsStrong" IS NOT NULL)`
    for (const r of rows) out.set(r.id, { benefits: parseBenefits(r.benefits), strong: r.benefitsStrong === true })
  } catch (error) {
    console.error('great-employers: job benefits read failed', error)
  }
  return out
}

/**
 * Stores the import's benefits for jobs by url — one statement per call, and
 * only rows whose values actually change are written (so an unchanged re-import
 * writes nothing). Skipped, with a count of 0, until the columns exist.
 */
export async function writeJobBenefits(rows: { url: string; benefits: JobBenefits | null; benefitsStrong: boolean | null }[]): Promise<number> {
  if (rows.length === 0 || !(await benefitsColumnsReady())) return 0
  const urls = rows.map((r) => r.url)
  const payloads = rows.map((r) => (r.benefits ? JSON.stringify(r.benefits) : null))
  const strong = rows.map((r) => r.benefitsStrong)
  return prisma.$executeRaw`
    UPDATE "ExclusiveJobPosting" p
    SET "benefits" = v.b::jsonb, "benefitsStrong" = v.s
    FROM unnest(${urls}::text[], ${payloads}::text[], ${strong}::boolean[]) AS v(u, b, s)
    WHERE p."url" = v.u AND (p."benefits" IS DISTINCT FROM v.b::jsonb OR p."benefitsStrong" IS DISTINCT FROM v.s)`
}
