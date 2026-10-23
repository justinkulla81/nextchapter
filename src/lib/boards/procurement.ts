import 'server-only'
import { prisma } from '@/lib/prisma'

interface Row { id: string; url: string | null; kind: string; items: { title: string; date: string | null }[] }

/**
 * Fills WorkforceBoard.procurementUrl/Kind/Items from the crawl bundled with the app (procurement.json, built by
 * scripts/boards/results-to-json.py). Runs when nothing has been loaded yet or the bundle is newer than the last load,
 * so a re-crawl reaches production on the next admin visit. Raw SQL so a missing column just throws and the caller ignores it.
 */
export async function seedBoardProcurement(): Promise<number> {
  const [{ n, last }] = await prisma.$queryRaw<{ n: bigint; last: Date | null }[]>`SELECT COUNT("procurementCheckedAt") AS n, MAX("procurementCheckedAt") AS last FROM "WorkforceBoard"`
  const data = (await import('./procurement.json')).default as unknown as { builtAt: string; rows: Row[] }
  const built = new Date(data.builtAt)
  if (Number(n) > 0 && last && last >= built) return 0
  let updated = 0
  for (const r of data.rows) {
    updated += await prisma.$executeRaw`
      UPDATE "WorkforceBoard" SET "procurementUrl" = ${r.url}, "procurementKind" = ${r.kind},
        "procurementItems" = ${JSON.stringify(r.items)}::jsonb, "procurementCheckedAt" = ${built}
      WHERE "id" = ${r.id}`
  }
  return updated
}
