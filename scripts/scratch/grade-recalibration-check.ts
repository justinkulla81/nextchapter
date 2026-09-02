// Empirical verification for the Market Reality Grade recalibration —
// reproduces composite.ts's blend-and-cap math (via the pure blend.ts
// helper, which has no 'server-only' import and is therefore importable
// from a plain script — composite.ts's own top-level 'server-only' import
// throws outside a Next/React-Server module context) against every real
// candidate's already-persisted component scores, and prints a before/
// after grade-distribution histogram. Read-only — never writes anything.
//
// Run: npx tsx --env-file=.env.local scripts/scratch/grade-recalibration-check.ts

import { PrismaClient } from '@prisma/client'
import { blendAndCap } from '../../src/lib/scoring/market-reality/blend'
import { getComponentWeights, type WeightedComponent } from '../../src/lib/scoring/market-reality/composite-weights.config'
import type { Grade } from '../../src/lib/scoring/grade'
import type { SeniorityBand } from '../../src/lib/scoring/resume-analysis/types'

const prisma = new PrismaClient()

// OLD cutoffs/boundary table, kept here ONLY as a labeled baseline for this
// one-off comparison — src/lib/scoring/grade.ts's scoreToGrade is already
// the recalibrated, live version; this is not a second copy anyone else
// should ever import.
function oldScoreToGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'F'
}
const OLD_GRADE_MAX_SCORE: Record<Grade, number> = { F: 19, D: 39, C: 74, B: 89, A: 100 }
const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']
function oldOneGradeAbove(grade: Grade): Grade {
  const idx = GRADE_ORDER.indexOf(grade)
  return GRADE_ORDER[Math.min(GRADE_ORDER.length - 1, idx + 1)]
}

function oldBlendAndCap(
  scores: Record<WeightedComponent, number | null>,
  weights: Record<WeightedComponent, number>,
  marketScore: number | null
): { compositeScore: number; grade: Grade } | null {
  const measured = (Object.keys(scores) as WeightedComponent[]).filter((key) => scores[key] !== null)
  if (measured.length === 0) return null

  const totalWeight = measured.reduce((sum, key) => sum + weights[key], 0)
  const weightedSum = measured.reduce((sum, key) => sum + (scores[key] as number) * weights[key], 0)
  let compositeScore = Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)))

  if (marketScore !== null) {
    const marketGrade = oldScoreToGrade(marketScore)
    const maxAllowedScore = OLD_GRADE_MAX_SCORE[oldOneGradeAbove(marketGrade)]
    if (compositeScore > maxAllowedScore) compositeScore = maxAllowedScore
  }

  return { compositeScore, grade: oldScoreToGrade(compositeScore) }
}

function emptyHistogram(): Record<Grade, number> {
  return { A: 0, B: 0, C: 0, D: 0, F: 0 }
}

async function main() {
  const rows = await prisma.marketRealityComponentScore.findMany({
    select: { candidateId: true, experienceScore: true, resumeScore: true, marketScore: true },
  })

  if (rows.length === 0) {
    console.log('No MarketRealityComponentScore rows yet — nothing to check.')
    return
  }

  const latestBands = await prisma.resumeAnalysis.findMany({
    where: { candidateId: { in: rows.map((r) => r.candidateId) } },
    orderBy: { createdAt: 'desc' },
    select: { candidateId: true, seniorityBand: true },
  })
  const bandByCandidate = new Map<string, SeniorityBand>()
  for (const b of latestBands) {
    if (!bandByCandidate.has(b.candidateId)) bandByCandidate.set(b.candidateId, b.seniorityBand as SeniorityBand)
  }

  const oldHistogram = emptyHistogram()
  const newHistogram = emptyHistogram()
  const tableRows: string[] = []
  let collapsedToOneGrade: Grade | null = null
  let allSameGrade = true

  for (const row of rows) {
    const band = bandByCandidate.get(row.candidateId) ?? null
    const weights = getComponentWeights(band)
    const scores: Record<WeightedComponent, number | null> = {
      EXPERIENCE: row.experienceScore,
      RESUME: row.resumeScore,
    }

    const oldResult = oldBlendAndCap(scores, weights, row.marketScore)
    const newResult = blendAndCap(scores, weights, row.marketScore)

    if (oldResult) oldHistogram[oldResult.grade]++
    if (newResult) {
      newHistogram[newResult.grade]++
      if (collapsedToOneGrade === null) collapsedToOneGrade = newResult.grade
      else if (collapsedToOneGrade !== newResult.grade) allSameGrade = false
    }

    tableRows.push(
      `  ${row.candidateId}  band=${band ?? 'unknown'}  old=${oldResult?.grade ?? '-'} (${oldResult?.compositeScore ?? '-'})  new=${newResult?.grade ?? '-'} (${newResult?.compositeScore ?? '-'})`
    )
  }

  console.log(`Per-candidate (${rows.length} rows with a MarketRealityComponentScore):`)
  tableRows.forEach((r) => console.log(r))

  console.log('\nOLD distribution:', oldHistogram)
  console.log('NEW distribution:', newHistogram)

  if (allSameGrade && rows.length > 1) {
    console.log(
      `\nWARNING: every candidate collapsed onto ${collapsedToOneGrade} under the new cutoffs — this is the same ` +
        'failure mode the recalibration is meant to fix, just shifted to a different letter. Re-check the cutoffs.'
    )
  }
}

main().finally(() => prisma.$disconnect())
