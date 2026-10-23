import type { BenefitProgramRow } from './types'

/** The slice of a Prisma client the upsert needs, so scripts (no server-only) and the app share one query. */
export interface RawDb {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>
}

export async function upsertProgramRows(db: RawDb, rows: BenefitProgramRow[]): Promise<number> {
  let n = 0
  for (const r of rows) {
    await db.$executeRaw`
      INSERT INTO "BenefitProgram" ("id","category","name","provider","scope","state","locality","amount","eligibility","status","statusNote","url","segments","verified","checkedAt","source","city","employer","employerKey")
      VALUES (${r.id}, ${r.category}, ${r.name}, ${r.provider}, ${r.scope}, ${r.state}, ${r.locality}, ${r.amount}, ${r.eligibility}, ${r.status}, ${r.statusNote},
              ${r.url}, ${r.segments}::text[], ${r.verified}, ${r.checkedAt}, ${r.source}, ${r.city}, ${r.employer}, ${r.employerKey})
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name", "provider" = EXCLUDED."provider", "scope" = EXCLUDED."scope", "state" = EXCLUDED."state", "locality" = EXCLUDED."locality",
        "amount" = EXCLUDED."amount", "eligibility" = EXCLUDED."eligibility", "status" = EXCLUDED."status", "statusNote" = EXCLUDED."statusNote",
        "url" = EXCLUDED."url", "segments" = EXCLUDED."segments", "verified" = EXCLUDED."verified", "checkedAt" = EXCLUDED."checkedAt",
        "source" = EXCLUDED."source", "city" = EXCLUDED."city", "employer" = EXCLUDED."employer", "employerKey" = EXCLUDED."employerKey", "updatedAt" = CURRENT_TIMESTAMP`
    n++
  }
  return n
}

