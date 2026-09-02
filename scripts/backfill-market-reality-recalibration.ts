// One-time backfill for the Market Reality Grade recalibration — applies
// the new grade cutoffs, dimensions, and modifiers to every real candidate
// who has already been through this pipeline. Two phases, because the
// weekly cron (market-reality-snapshot.ts) only recomputes the composite/
// probability from already-persisted component scores — it never refreshes
// experienceScore/resumeScore/marketScore themselves:
//
//   Phase A (cheap, no LLM): every candidate with a MarketRealityComponentScore
//   row gets computeProbabilityGrade() re-run, picking up the new
//   scoreToGrade/GRADE_MAX_SCORE cutoffs immediately by re-blending
//   whatever component scores are already persisted.
//   Phase B (LLM re-extraction): every candidate with a resume on this
//   pipeline gets computeResumeAnalysis() re-run on their latest resume
//   (picks up the two new dimensions, the promotion-velocity modifier, and
//   the wider prestige cap), then computeMarketRealityComponents() (picks
//   up the new industry-narrowed market leg), then Phase A again on top.
//
// This script imports resume-analysis/compute.ts, market-reality/compute.ts,
// and market-reality/probability.ts directly — all three carry a top-level
// `import 'server-only'`, which throws under a plain Node module resolution
// (see server-only's package.json: only the 'react-server' export condition
// resolves to a no-op). Node's --conditions flag lets a real Node process
// opt into that condition for module resolution, so this script MUST be run
// with it set — omitting it fails immediately with server-only's own error,
// not a silent misbehavior.
//
// Run:
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-market-reality-recalibration.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-market-reality-recalibration.ts --dry-run

import { PrismaClient } from '@prisma/client'
import { computeProbabilityGrade } from '../src/lib/scoring/market-reality/probability'
import { computeMarketRealityComponents } from '../src/lib/scoring/market-reality/compute'
import { computeResumeAnalysis } from '../src/lib/scoring/resume-analysis/compute'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// Force-reseeds perAttemptProbability so computeProbabilityGrade's own
// "seed once" guard (which reads the existing, now-stale value as "already
// seeded") re-seeds from the NEW starting band's midpoint instead of
// silently reusing a value computed under the old cutoffs. Never touches a
// candidate with a real, observed-outcome calibration adjustment on record
// — that value reflects real data more recent than any cutoff change and
// must not be discarded.
async function reseedIfNeverCalibrated(candidateId: string): Promise<boolean> {
  const hasRealAdjustment = await prisma.marketRealityCalibrationCheck.findFirst({
    where: { candidateId, adjustmentApplied: true },
  })
  if (hasRealAdjustment) return false
  if (!DRY_RUN) {
    await prisma.marketRealityComponentScore.update({
      where: { candidateId },
      data: { perAttemptProbability: null },
    })
  }
  return true
}

async function runPhaseA(candidateIds: string[]) {
  console.log(`\n=== Phase A: cutoff refresh (${candidateIds.length} candidates) ===`)
  for (const candidateId of candidateIds) {
    const before = await prisma.marketRealityComponentScore.findUnique({
      where: { candidateId },
      select: { grade: true, probabilityGrade: true },
    })
    const reseeded = await reseedIfNeverCalibrated(candidateId)
    const result = DRY_RUN ? null : await computeProbabilityGrade(candidateId)
    console.log(
      `  ${candidateId}  grade ${before?.grade ?? '-'} -> ${DRY_RUN ? '(dry-run)' : (result?.startingBand ?? '-')}` +
        `  probabilityGrade ${before?.probabilityGrade ?? '-'} -> ${DRY_RUN ? '(dry-run)' : (result?.probabilityGrade ?? '-')}` +
        `  reseeded=${reseeded}`
    )
  }
}

async function runPhaseB() {
  const candidatesWithResume = await prisma.candidateProfile.findMany({
    where: { marketRealityComponentScore: { isNot: null } },
    select: {
      id: true,
      resumes: { orderBy: { uploadedAt: 'desc' }, take: 1, select: { id: true, extractedText: true } },
    },
  })
  const eligible = candidatesWithResume.filter((c) => c.resumes[0]?.extractedText)
  console.log(`\n=== Phase B: resume re-analysis (${eligible.length} candidates with a resume) ===`)

  for (const candidate of eligible) {
    const resumeId = candidate.resumes[0].id
    if (DRY_RUN) {
      console.log(`  ${candidate.id}  would re-run computeResumeAnalysis(${resumeId})`)
      continue
    }
    const analysis = await computeResumeAnalysis(resumeId)
    if (!analysis) {
      console.log(`  ${candidate.id}  computeResumeAnalysis returned null (self-check failed or no extracted text) — skipped`)
      continue
    }
    await computeMarketRealityComponents(candidate.id)
    console.log(
      `  ${candidate.id}  new experienceScore=${analysis.experienceScore} (${analysis.experienceBand})` +
        `  resumeScore=${analysis.resumeScore} (${analysis.resumeBand})`
    )
  }

  // Re-run Phase A on top so the composite/probability grade reflects the
  // freshly recomputed component scores, not the pre-Phase-B ones.
  await runPhaseA(eligible.map((c) => c.id))
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no writes will be made.\n')

  const allCandidateIds = (
    await prisma.marketRealityComponentScore.findMany({ select: { candidateId: true } })
  ).map((r) => r.candidateId)

  if (allCandidateIds.length === 0) {
    console.log('No MarketRealityComponentScore rows yet — nothing to backfill.')
    return
  }

  await runPhaseA(allCandidateIds)
  await runPhaseB()

  console.log('\nDone.')
}

main().finally(() => prisma.$disconnect())
