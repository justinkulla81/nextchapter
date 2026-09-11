// Verifies the level-group market fix specifically — re-runs only
// computeMarketRealityComponents + computeProbabilityGrade (NOT
// computeResumeAnalysis again, no extra LLM cost) for the same 4 candidates,
// so we can see the market score move without re-paying for resume
// extraction. Requires the react-server module-resolution condition.
//
// Run:
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/scratch/spot-check-market-fix.ts

import { PrismaClient } from '@prisma/client'
import { computeMarketRealityComponents } from '../../src/lib/scoring/market-reality/compute'
import { computeProbabilityGrade } from '../../src/lib/scoring/market-reality/probability'

const prisma = new PrismaClient()

const CANDIDATE_IDS = [
  'cmtj2ymdd006ljx04fs71jlg1', // Linda Lee — Talent Partner (staff title, should be unaffected)
  'cmthi8v0f0000l704v78m6byx', // Justin Kulla — VP of Corporate Development
  'cms7smomb0006jj04m4pwu1di', // Justin Kulla — CFO
  'cmsrp6fqv0001ju04secdht6x', // Justin Kulla — Partner
]

async function main() {
  for (const candidateId of CANDIDATE_IDS) {
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { firstName: true, lastName: true, targetRoleType: true },
    })
    const before = await prisma.marketRealityComponentScore.findUnique({
      where: { candidateId },
      select: { marketScore: true, marketDrivers: true, grade: true },
    })

    await computeMarketRealityComponents(candidateId)
    const probability = await computeProbabilityGrade(candidateId)

    const after = await prisma.marketRealityComponentScore.findUnique({
      where: { candidateId },
      select: { marketScore: true, marketDrivers: true, grade: true },
    })

    console.log(`\n${candidate.firstName} ${candidate.lastName} — "${candidate.targetRoleType}"`)
    console.log(`  Market score: ${before?.marketScore} -> ${after?.marketScore}`)
    console.log(`  Market drivers before:`, JSON.stringify(before?.marketDrivers))
    console.log(`  Market drivers after: `, JSON.stringify(after?.marketDrivers))
    console.log(`  Grade: ${before?.grade} -> ${after?.grade}  (probabilityGrade: ${probability?.probabilityGrade})`)
  }
}

main().finally(() => prisma.$disconnect())
