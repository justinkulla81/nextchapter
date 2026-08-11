// One-time seed script: inserts the frozen "How I Work Best" item bank
// (src/lib/constants/how-i-work-best-items.ts) as LikertItem rows under a
// new rotationGroup, and seeds ZERO QuadBlock rows for that rotation — the
// Assessment Layer rebuild cuts quad-blocks entirely (spec §2.1).
//
// Unlike scripts/seed-assessment-content.ts, this reads static content from
// the repo rather than calling the Anthropic API — the whole point of
// freezing the bank is that item text stops regenerating per seed run.
//
// Run: npx tsx --env-file=.env.local scripts/seed-how-i-work-best-frozen.ts
//
// After running, bump CURRENT_ASSESSMENT_ROTATION_GROUP in
// src/lib/constants/onboarding.ts to match NEW_ROTATION_GROUP below so the
// live app actually serves this content.

import { PrismaClient } from '@prisma/client'
import { HOW_I_WORK_BEST_ITEMS } from '../src/lib/constants/how-i-work-best-items'

const prisma = new PrismaClient()

const NEW_ROTATION_GROUP = 3

async function main() {
  const existing = await prisma.likertItem.count({ where: { rotationGroup: NEW_ROTATION_GROUP } })
  if (existing > 0) {
    throw new Error(
      `rotationGroup ${NEW_ROTATION_GROUP} already has ${existing} LikertItem rows — bump NEW_ROTATION_GROUP or clear it first.`
    )
  }

  await prisma.likertItem.createMany({
    data: HOW_I_WORK_BEST_ITEMS.map((item) => ({
      dimension: item.dimension.toLowerCase(),
      pole: item.isReversed ? 'low' : 'high',
      itemText: item.text,
      isReversed: item.isReversed,
      // Not used for scoring in the Likert-only rotation (see
      // updateAssessment's isLikertOnlyRotation branch, which skips
      // computeInconsistency entirely) — required non-null columns on a
      // model shared with the legacy quad+Likert instrument.
      targetedFriction: `${item.dimension} — self-report calibration item, no quad cross-validation in this rotation`,
      pairedQuadDimension: item.dimension.toLowerCase(),
      rotationGroup: NEW_ROTATION_GROUP,
      isActive: true,
    })),
  })

  console.log(`Seeded ${HOW_I_WORK_BEST_ITEMS.length} LikertItem rows under rotationGroup ${NEW_ROTATION_GROUP}.`)
  console.log('No QuadBlock rows seeded for this rotation — quad-blocks are cut per spec.')
  console.log(`Next: set CURRENT_ASSESSMENT_ROTATION_GROUP = ${NEW_ROTATION_GROUP} in src/lib/constants/onboarding.ts`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
