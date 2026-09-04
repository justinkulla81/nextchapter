// Spot-check for the shared overlap detector (overlap-detection.ts) against
// real WorkHistoryEntry data — confirms it fires only on genuine
// dominant-vs-dominant overlaps and stays silent on legitimate concurrent
// board/advisor roles. Read-only.
//
// Run: npx tsx --env-file=.env.local scripts/scratch/overlap-detection-check.ts

import { PrismaClient } from '@prisma/client'
import { detectOverlappingRolePairs } from '../../src/lib/scoring/resume-analysis/overlap-detection'

const prisma = new PrismaClient()

async function main() {
  const candidates = await prisma.candidateProfile.findMany({
    where: { workHistory: { some: {} } },
    select: { id: true, firstName: true, lastName: true, workHistory: true },
  })

  let candidatesWithOverlap = 0
  for (const c of candidates) {
    const pairs = detectOverlappingRolePairs(
      c.workHistory.map((e) => ({
        title: e.roleTitle,
        company: e.companyName,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        isCurrent: e.isCurrent,
        isInternship: e.engagementType === 'INTERNSHIP',
      }))
    )
    if (pairs.length > 0) {
      candidatesWithOverlap++
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id
      console.log(`${name}:`)
      for (const p of pairs) {
        console.log(`  "${p.earlier.title}" @ ${p.earlier.company}  <->  "${p.later.title}" @ ${p.later.company}`)
      }
    }
  }

  console.log(`\n${candidatesWithOverlap} of ${candidates.length} candidates with work history flagged with a real overlap.`)
}

main().finally(() => prisma.$disconnect())
