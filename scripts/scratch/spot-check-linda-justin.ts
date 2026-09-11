// One-off spot check: re-run the real Market Reality Grade pipeline for
// specific named candidates and print a full rationale breakdown. Requires
// the react-server module-resolution condition (see
// backfill-market-reality-recalibration.ts's header for why).
//
// Run:
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/scratch/spot-check-linda-justin.ts

import { PrismaClient } from '@prisma/client'
import { computeResumeAnalysis } from '../../src/lib/scoring/resume-analysis/compute'
import { computeMarketRealityComponents } from '../../src/lib/scoring/market-reality/compute'
import { computeProbabilityGrade } from '../../src/lib/scoring/market-reality/probability'

const prisma = new PrismaClient()

const CANDIDATE_IDS = [
  'cmtj2ymdd006ljx04fs71jlg1', // Linda Lee
  'cmthi8v0f0000l704v78m6byx', // Justin Kulla — VP of Corporate Development
  'cms7smomb0006jj04m4pwu1di', // Justin Kulla — CFO
  'cmsrp6fqv0001ju04secdht6x', // Justin Kulla — Partner
]

async function main() {
  for (const candidateId of CANDIDATE_IDS) {
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { firstName: true, lastName: true, targetRoleType: true, primaryFunction: true, targetIndustries: true },
    })
    const resume = await prisma.resume.findFirst({
      where: { candidateId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true },
    })

    console.log(`\n${'='.repeat(70)}`)
    console.log(`${candidate.firstName} ${candidate.lastName} (${candidateId}) — target: ${candidate.targetRoleType} / ${candidate.primaryFunction}`)
    console.log('='.repeat(70))

    if (!resume) {
      console.log('  No resume on file — skipped.')
      continue
    }

    const analysis = await computeResumeAnalysis(resume.id)
    if (!analysis) {
      console.log('  computeResumeAnalysis returned null (self-check failed or no extracted text).')
      continue
    }

    await computeMarketRealityComponents(candidateId)
    const probability = await computeProbabilityGrade(candidateId)

    const fullAnalysis = await prisma.resumeAnalysis.findUnique({
      where: { id: analysis.resumeAnalysisId },
      select: {
        seniorityBand: true,
        functionFamily: true,
        dimensionScores: true,
        dimensionFindings: true,
        prestigeBonus: true,
        reconciliationPenalty: true,
        extracurricularBonus: true,
      },
    })
    const component = await prisma.marketRealityComponentScore.findUnique({
      where: { candidateId },
      select: {
        experienceScore: true,
        resumeScore: true,
        marketScore: true,
        marketDrivers: true,
        compositeScore: true,
        grade: true,
        drivingComponent: true,
        strongestComponent: true,
      },
    })

    console.log(`  Seniority band: ${fullAnalysis?.seniorityBand}  Function family: ${fullAnalysis?.functionFamily}`)
    console.log(`  Experience: ${component?.experienceScore}  Resume: ${component?.resumeScore}  Market: ${component?.marketScore}`)
    console.log(`  Composite: ${component?.compositeScore}  Grade: ${component?.grade}  Driving: ${component?.drivingComponent}  Strongest: ${component?.strongestComponent}`)
    console.log(`  Probability grade (candidate-facing): ${probability?.probabilityGrade}  starting band: ${probability?.startingBand}`)
    console.log(`  Prestige bonus: ${fullAnalysis?.prestigeBonus}  Reconciliation penalty: ${fullAnalysis?.reconciliationPenalty}  Extracurricular bonus: ${fullAnalysis?.extracurricularBonus}`)
    console.log('  Dimension scores:', JSON.stringify(fullAnalysis?.dimensionScores))
    console.log('  Market drivers:', JSON.stringify(component?.marketDrivers))

    const findings = fullAnalysis?.dimensionFindings as Record<string, unknown[]> | undefined
    if (findings) {
      for (const [dim, list] of Object.entries(findings)) {
        if (Array.isArray(list) && list.length > 0) {
          console.log(`  [${dim}] findings:`, JSON.stringify(list))
        }
      }
    }
  }
}

main().finally(() => prisma.$disconnect())
