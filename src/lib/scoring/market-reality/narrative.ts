// Headline narrative — Market Reality Grade 2.0 Phase 4. Pure templating
// over already-computed, already-persisted data (composite.ts,
// resume-analysis/compute.ts, evidence/market/channels.ts) — no LLM call,
// so the prose can never drift from the score it describes (Report
// Structure Spec §6 rule 1). Matches the user's own worked example:
// "Market Reality: C — moderate difficulty. Your record is an A; the
// constraint is that roles at your level are scarce and your network is
// unused." — rendered here as a headline plus two supporting lines rather
// than one spliced sentence, since forcing arbitrary driver prose into a
// single grammatical clause is fragile; two clean sentences beat one
// occasionally-broken one.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { scoreToGrade, type Grade } from '@/lib/scoring/grade'
import type { MarketRealityComponent } from './composite'

export interface MarketRealityHeadline {
  headline: string // "Market Reality: C — moderate difficulty."
  strongestLine: string // "Your record is a B — that part is working."
  constraintLine: string // the driving component's driver sentence, verbatim
}

const COMPONENT_LABEL: Record<MarketRealityComponent, string> = {
  RECORD: 'record',
  EVIDENCE: 'evidence',
  MARKET: 'market',
  CHANNELS: 'network',
}

// Deliberately collapses to 4 tiers over 5 letter grades — B and C both
// read as "moderate," matching the user's own worked example ("Market
// Reality: C — moderate difficulty") and grade.ts's hard-grading curve,
// where most candidates land on C by design.
const DIFFICULTY_LABEL: Record<Grade, string> = {
  A: 'low difficulty',
  B: 'moderate difficulty',
  C: 'moderate difficulty',
  D: 'high difficulty',
  F: 'very high difficulty',
}

async function getComponentDriverText(
  candidateId: string,
  component: MarketRealityComponent
): Promise<string> {
  if (component === 'RECORD') {
    const analysis = await prisma.resumeAnalysis.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { dimensionFindings: true },
    })
    const findings = (analysis?.dimensionFindings ?? {}) as Record<string, Array<{ candidateFacingCopy: string; estimatedPointGain: number }>>
    const allFindings = Object.values(findings).flat()
    if (allFindings.length === 0) {
      return 'No major issues found in the resume itself.'
    }
    const topFinding = allFindings.reduce((worst, f) => (f.estimatedPointGain > worst.estimatedPointGain ? f : worst))
    return topFinding.candidateFacingCopy
  }

  const row = await prisma.marketRealityComponentScore.findUnique({
    where: { candidateId },
    select: { evidenceDrivers: true, marketDrivers: true, channelsDrivers: true },
  })
  const fieldMap = { EVIDENCE: row?.evidenceDrivers, MARKET: row?.marketDrivers, CHANNELS: row?.channelsDrivers } as const
  const drivers = (fieldMap[component] as string[] | null) ?? []
  return drivers[0] ?? `No data yet for ${COMPONENT_LABEL[component]}.`
}

export async function buildMarketRealityHeadline(candidateId: string): Promise<MarketRealityHeadline | null> {
  const row = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId } })
  if (
    !row ||
    row.compositeScore === null ||
    !row.grade ||
    !row.drivingComponent ||
    !row.strongestComponent ||
    row.recordScore === null ||
    row.evidenceScore === null ||
    row.marketScore === null ||
    row.channelsScore === null
  ) {
    return null
  }

  const grade = row.grade as Grade
  const strongestComponent = row.strongestComponent as MarketRealityComponent
  const drivingComponent = row.drivingComponent as MarketRealityComponent

  const scores: Record<MarketRealityComponent, number> = {
    RECORD: row.recordScore,
    EVIDENCE: row.evidenceScore,
    MARKET: row.marketScore,
    CHANNELS: row.channelsScore,
  }
  const strongestGrade = scoreToGrade(scores[strongestComponent])

  const headline = `Market Reality: ${grade} — ${DIFFICULTY_LABEL[grade]}.`
  // Only claim "that part is working" when the strongest component is
  // genuinely strong (A/B) — echoing it for a merely-average strongest
  // component would be exactly the manufactured-warmth failure the Voice
  // spec calls out (§4.2: "never praise what isn't there").
  const strongestIsGenuinelyStrong = strongestGrade === 'A' || strongestGrade === 'B'
  const strongestLine = `Your ${COMPONENT_LABEL[strongestComponent]} is a ${strongestGrade}${strongestIsGenuinelyStrong ? ' — that part is working' : ''}.`
  const constraintLine = await getComponentDriverText(candidateId, drivingComponent)

  return { headline, strongestLine, constraintLine }
}
