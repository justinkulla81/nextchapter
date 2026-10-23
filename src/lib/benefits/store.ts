import 'server-only'
import { prisma } from '@/lib/prisma'
import { placeKey } from '@/lib/workforce/places'
import { upsertProgramRows } from './upsert'
import { CATEGORY_ORDER, type BenefitCategory, type BenefitProgramRow } from './types'

/**
 * BenefitProgram reads and writes, by raw SQL, so every caller survives the table
 * not existing yet (prisma/manual/benefit-programs.sql is applied by hand).
 * Each function throws on a missing table; callers decide what to do.
 */

const COLUMNS = `"id","category","name","provider","scope","state","locality","amount","eligibility","status","statusNote","url","segments","verified","checkedAt","source","city","employer","employerKey","geoAreaId"`

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
export async function programsForDeck(state: string | null, perCategory = 3, areaId: string | null = null): Promise<BenefitProgramRow[]> {
  try {
    await seedCatalogIfEmpty()
    const all = await listPrograms({ state: state ?? undefined, limit: 400 })
    const live = all.filter((r) => r.status !== 'CLOSED' && r.url && (!r.employerKey || r.category === 'PAID'))
    const out: BenefitProgramRow[] = []
    for (const c of CATEGORY_ORDER) {
      const mine = live.filter((r) => r.category === c)
      // This county's own programs first, then this state's, then national ones.
      const county = mine.filter((r) => areaId && r.geoAreaId === areaId)
      const local = [...county, ...mine.filter((r) => !county.includes(r) && r.state && r.state === state)]
      out.push(...[...local, ...mine.filter((r) => !local.includes(r))].slice(0, perCategory))
    }
    return out
  } catch {
    return []
  }
}

/**
 * Fills the table from the catalog bundled with the app (src/lib/benefits/catalog.json, built by
 * scripts/benefits/build-catalog.ts). Runs when the table is empty or was last written before the
 * bundled catalog was built, so a catalog update reaches production on the next admin visit.
 */
export async function seedCatalogIfEmpty(): Promise<number> {
  const [{ n, last }] = await prisma.$queryRaw<{ n: bigint; last: Date | null }[]>`SELECT COUNT(*) AS n, MAX("updatedAt") AS last FROM "BenefitProgram"`
  const catalog = (await import('./catalog.json')).default as unknown as { builtAt: string; rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }
  if (Number(n) > 0 && last && last >= new Date(catalog.builtAt)) return 0
  const written = await upsertPrograms(catalog.rows.map((r) => ({ ...r, checkedAt: r.checkedAt ? new Date(r.checkedAt) : null })))
  await linkBenefitGeo()
  return written
}

const ORDER = `ORDER BY "verified" DESC, ("status" = 'OPEN' OR "status" = 'ROLLING') DESC, "name"`

/**
 * Ties local programs to a county GeoArea. A program whose locality or city names a county
 * ("Floyd County") is matched by name; one that names a city or town is matched through the
 * GeoPlace table to its county. Only fills rows that have no geoAreaId yet.
 */
export async function linkBenefitGeo(): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: string; state: string; locality: string | null; city: string | null }[]>`
    SELECT "id","state","locality","city" FROM "BenefitProgram"
    WHERE "geoAreaId" IS NULL AND "state" IS NOT NULL AND ("locality" IS NOT NULL OR "city" IS NOT NULL)`
  let linked = 0
  for (const r of rows) {
    const tokens = [r.city, ...(r.locality ?? '').split(/[;,/]| and /)].map((t) => (t ?? '').trim()).filter((t) => t.length > 2)
    let areaId: string | null = null
    for (const t of tokens) {
      const county = /\b(county|parish|borough)\b/i.test(t)
        ? await prisma.geoArea.findFirst({ where: { level: 'COUNTY', state: r.state, name: { equals: t.replace(/^.*?\b(?=\w+ (county|parish|borough)$)/i, ''), mode: 'insensitive' } }, select: { id: true } })
        : null
      if (county) { areaId = county.id; break }
      const place = await prisma.geoPlace.findFirst({ where: { state: r.state, nameKey: placeKey(t) }, orderBy: { population: { sort: 'desc', nulls: 'last' } }, select: { county: true } })
      if (place?.county) {
        const c = await prisma.geoArea.findFirst({ where: { level: 'COUNTY', state: r.state, name: { startsWith: place.county.replace(/ (County|Parish|Borough)$/i, ''), mode: 'insensitive' } }, select: { id: true } })
        if (c) { areaId = c.id; break }
      }
    }
    if (areaId) { await prisma.$executeRaw`UPDATE "BenefitProgram" SET "geoAreaId" = ${areaId} WHERE "id" = ${r.id}`; linked++ }
  }
  return linked
}

/** Programs tied to one county, then the ones that apply across its state. Empty on a missing table. */
export async function programsForArea(areaId: string, state: string): Promise<{ local: BenefitProgramRow[]; statewide: BenefitProgramRow[] }> {
  try {
    const local = await prisma.$queryRawUnsafe<BenefitProgramRow[]>(`SELECT ${COLUMNS} FROM "BenefitProgram" WHERE "geoAreaId" = $1 AND "status" <> 'CLOSED' ${ORDER} LIMIT 60`, areaId)
    const statewide = await prisma.$queryRawUnsafe<BenefitProgramRow[]>(
      `SELECT ${COLUMNS} FROM "BenefitProgram" WHERE "state" = $1 AND "geoAreaId" IS NULL AND "employerKey" IS NULL AND "status" <> 'CLOSED' ${ORDER} LIMIT 40`, state)
    return { local, statewide }
  } catch {
    return { local: [], statewide: [] }
  }
}

/** Programs an employer itself offers (relocation packages and the like), by its normalized name. */
export async function programsForEmployer(employerKey: string): Promise<BenefitProgramRow[]> {
  try {
    return await prisma.$queryRawUnsafe<BenefitProgramRow[]>(`SELECT ${COLUMNS} FROM "BenefitProgram" WHERE "employerKey" = $1 ${ORDER} LIMIT 40`, employerKey)
  } catch {
    return []
  }
}
