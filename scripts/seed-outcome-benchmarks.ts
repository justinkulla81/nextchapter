// Seeds DurationBenchmark and PayChangeBenchmark from the sourced starter set in
// src/lib/outcomes/benchmark-seed-data.ts. Every row is flagged isSampleData so
// reviewers know to verify it against the original source. Idempotent: upserts
// on the unique keys and never deletes admin-edited rows.
//
// Run: npm run seed:outcome-benchmarks

import { PrismaClient } from '@prisma/client'
import { DURATION_SEED, PAY_CHANGE_SEED } from '../src/lib/outcomes/benchmark-seed-data'

const prisma = new PrismaClient()

async function main() {
  for (const r of DURATION_SEED) {
    await prisma.durationBenchmark.upsert({
      where: { bucket_group_sourceTitle: { bucket: r.bucket, group: r.group, sourceTitle: r.sourceTitle } },
      create: { ...r, isSampleData: true },
      update: {},
    })
  }
  for (const r of PAY_CHANGE_SEED) {
    await prisma.payChangeBenchmark.upsert({
      where: { pathType_group_sourceTitle: { pathType: r.pathType, group: r.group, sourceTitle: r.sourceTitle } },
      create: {
        pathType: r.pathType,
        group: r.group,
        lowPct: r.lowPct,
        highPct: r.highPct,
        medianPct: r.medianPct,
        sampleSize: r.sampleSize,
        confidence: r.confidence,
        sourceTitle: r.sourceTitle,
        sourceUrl: r.sourceUrl,
        asOf: r.asOf,
        notes: r.notes,
        isSampleData: true,
      },
      update: {},
    })
  }
  console.log(`Seeded ${DURATION_SEED.length} duration and ${PAY_CHANGE_SEED.length} pay-change benchmarks (flagged isSampleData).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
