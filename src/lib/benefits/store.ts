import 'server-only'
import { prisma } from '@/lib/prisma'
import { upsertProgramRows } from './upsert'
import { CATEGORY_ORDER, type BenefitCategory, type BenefitProgramRow } from './types'

/**
 * BenefitProgram reads and writes, by raw SQL, so every caller survives the table
 * not existing yet (prisma/manual/benefit-programs.sql is applied by hand).
 * Each function throws on a missing table; callers decide what to do.
 */

const COLUMNS = `"id","category","name","provider","scope","state","locality","amount","eligibility","status","statusNote","url","segments","verified","checkedAt","source"`

export const upsertPrograms = (rows: BenefitProgramRow[]) => upsertProgramRows(prisma, rows)

export interface ListFilter {
  category?: BenefitCategory
  /** A state shows its own programs plus every national one. */
  state?: string
  status?: string
  q?: string
  verifiedOnly?: boolean
  limit?: number
}

export async function listPrograms(f: ListFilter = {}): Promise<BenefitProgramRow[]> {
  const rows = await prisma.$queryRawUnsafe<BenefitProgramRow[]>(
    `SELECT ${COLUMNS} FROM "BenefitProgram"
      WHERE ($1::text IS NULL OR "category" = $1)
        AND ($2::text IS NULL OR "state" = $2 OR "scope" = 'NATIONAL')
        AND ($3::text IS NULL OR "status" = $3)
        AND ($4::text IS NULL OR ("name" ILIKE '%' || $4 || '%' OR "provider" ILIKE '%' || $4 || '%' OR "eligibility" ILIKE '%' || $4 || '%'))
        AND ($5::boolean IS NOT TRUE OR "verified" = true)
      ORDER BY "verified" DESC, ("status" = 'OPEN' OR "status" = 'ROLLING') DESC, "state" NULLS FIRST, "name"
      LIMIT $6`,
    f.category ?? null, f.state ?? null, f.status ?? null, f.q?.trim() || null, f.verifiedOnly ?? null, f.limit ?? 500,
  )
  return rows
}

export async function countByCategory(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ category: string; n: bigint }[]>`SELECT "category", COUNT(*) AS n FROM "BenefitProgram" GROUP BY "category"`
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.n)]))
}

/**
 * Programs for a pitch deck: verified and open first, this state's own before national, spread
 * across categories so a deck is not eight relocation grants. Empty on a missing table.
 */
export async function programsForDeck(state: string | null, perCategory = 3): Promise<BenefitProgramRow[]> {
  try {
    await seedCatalogIfEmpty()
    const all = await listPrograms({ state: state ?? undefined, limit: 400 })
    const live = all.filter((r) => r.status !== 'CLOSED' && r.url)
    const out: BenefitProgramRow[] = []
    for (const c of CATEGORY_ORDER) {
      const mine = live.filter((r) => r.category === c)
      const local = mine.filter((r) => r.state && r.state === state)
      out.push(...[...local, ...mine.filter((r) => !local.includes(r))].slice(0, perCategory))
    }
    return out
  } catch {
    return []
  }
}

/**
 * Fills an empty table from the catalog bundled with the app (src/lib/benefits/catalog.json, built by
 * scripts/benefits/build-catalog.ts). Only runs when the table has no rows, so it never overwrites.
 */
export async function seedCatalogIfEmpty(): Promise<number> {
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "BenefitProgram"`
  if (Number(n) > 0) return 0
  const catalog = (await import('./catalog.json')).default as unknown as (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[]
  return upsertPrograms(catalog.map((r) => ({ ...r, checkedAt: r.checkedAt ? new Date(r.checkedAt) : null })))
}
