// One-time cleanup: hard-deletes orphaned rotationGroup-1 assessment content
// (QuadBlock/QuadBlockStatement/LikertItem). rotationGroup 1 predates this
// codebase — no seed script here ever wrote it — and is superseded by
// rotationGroup 2 (archived) and rotationGroup 3 (current, see
// CURRENT_ASSESSMENT_ROTATION_GROUP in src/lib/constants/onboarding.ts).
//
// Every query site filters by the live rotationGroup, and
// CandidateAssessmentResponse stores raw blockId/itemId strings in JSON
// (quadResponses/likertResponses) rather than a DB-enforced FK — so before
// deleting, this script scans every stored response for any reference to a
// rotationGroup-1 id and aborts if it finds one, rather than trusting the
// "zero responses reference it" premise blindly.
//
// Run: npx tsx --env-file=.env.local scripts/cleanup-rotation-group-1.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ORPHANED_ROTATION_GROUP = 1

async function main() {
  const [blocks, likertItems] = await Promise.all([
    prisma.quadBlock.findMany({ where: { rotationGroup: ORPHANED_ROTATION_GROUP }, select: { id: true } }),
    prisma.likertItem.findMany({ where: { rotationGroup: ORPHANED_ROTATION_GROUP }, select: { id: true } }),
  ])
  const blockIds = new Set(blocks.map((b) => b.id))
  const likertItemIds = new Set(likertItems.map((i) => i.id))

  if (blockIds.size === 0 && likertItemIds.size === 0) {
    console.log(`No rotationGroup ${ORPHANED_ROTATION_GROUP} content found — nothing to do.`)
    return
  }
  console.log(`Found ${blockIds.size} QuadBlock rows and ${likertItemIds.size} LikertItem rows under rotationGroup ${ORPHANED_ROTATION_GROUP}.`)

  const responses = await prisma.candidateAssessmentResponse.findMany({
    select: { id: true, candidateId: true, quadResponses: true, likertResponses: true },
  })

  let referencingResponses = 0
  for (const response of responses) {
    const quad = Array.isArray(response.quadResponses) ? response.quadResponses : []
    const likert = Array.isArray(response.likertResponses) ? response.likertResponses : []
    const referencesBlock = quad.some(
      (r) => r && typeof r === 'object' && 'blockId' in r && blockIds.has((r as { blockId: string }).blockId)
    )
    const referencesLikert = likert.some(
      (r) => r && typeof r === 'object' && 'itemId' in r && likertItemIds.has((r as { itemId: string }).itemId)
    )
    if (referencesBlock || referencesLikert) {
      referencingResponses++
      console.error(
        `CandidateAssessmentResponse ${response.id} (candidate ${response.candidateId}) references rotationGroup ${ORPHANED_ROTATION_GROUP} content.`
      )
    }
  }

  if (referencingResponses > 0) {
    console.error(
      `Aborting: ${referencingResponses} response(s) reference rotationGroup ${ORPHANED_ROTATION_GROUP} content. Resolve before deleting.`
    )
    process.exit(1)
  }

  console.log(`Confirmed: 0 of ${responses.length} candidate responses reference rotationGroup ${ORPHANED_ROTATION_GROUP} content. Proceeding with delete.`)

  const deletedStatements = await prisma.quadBlockStatement.deleteMany({ where: { blockId: { in: [...blockIds] } } })
  const deletedBlocks = await prisma.quadBlock.deleteMany({ where: { rotationGroup: ORPHANED_ROTATION_GROUP } })
  const deletedLikertItems = await prisma.likertItem.deleteMany({ where: { rotationGroup: ORPHANED_ROTATION_GROUP } })

  console.log(
    `Deleted ${deletedStatements.count} QuadBlockStatement rows, ${deletedBlocks.count} QuadBlock rows, ${deletedLikertItems.count} LikertItem rows.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
