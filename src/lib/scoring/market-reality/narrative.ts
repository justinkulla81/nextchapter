// Headline narrative — Master Build Script §3.7: "always name what's
// driving the grade — one-sentence headline naming the driver, not a
// second number." Pure templating over already-computed, already-persisted
// data (composite.ts, resume-analysis/compute.ts, evidence/market/
// effort.ts) — no LLM call, so the prose can never drift from the score it
// describes (Report Structure Spec §6 rule 1). Matches the user's own
// worked example: "Market Reality: C — moderate difficulty. Your
// experience is an A; the constraint is that roles at your level are
// scarce and your network is unused." — rendered here as a headline plus
// two supporting lines rather than one spliced sentence, since forcing
// arbitrary driver prose into a single grammatical clause is fragile; two
// clean sentences beat one occasionally-broken one.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { scoreToGrade, type Grade } from '@/lib/scoring/grade'
import { DIMENSION_COMPONENT } from '../resume-analysis/types'
import type { MarketRealityComponent } from './composite'

export interface MarketRealityHeadline {
  headline: string // "Market Reality: C — moderate difficulty."
  strongestLine: string // "Your experience is a B — that part is working."
  constraintLine: string // the driving component's driver sentence(s), verbatim
}

const COMPONENT_LABEL: Record<MarketRealityComponent, string> = {
  EXPERIENCE: 'experience',
  RESUME: 'resume',
  EVIDENCE: 'evidence',
  EFFORT: 'effort',
  MARKET: 'market',
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

async function getResumeAnalysisDriverText(candidateId: string, component: 'EXPERIENCE' | 'RESUME'): Promise<string> {
  const analysis = await prisma.resumeAnalysis.findFirst({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    select: { dimensionFindings: true },
  })
  const findings = (analysis?.dimensionFindings ?? {}) as Record<string, Array<{ candidateFacingCopy: string; estimatedPointGain: number }>>
  // Only findings from dimensions that belong to this component — Your
  // Experience must never surface a Resume-only finding (a mechanics typo)
  // as if it were a career-level issue, and vice versa.
  const relevantFindings = Object.entries(findings)
    .filter(([dimensionKey]) => DIMENSION_COMPONENT[dimensionKey as keyof typeof DIMENSION_COMPONENT] === component)
    .flatMap(([, findingsForDimension]) => findingsForDimension)

  if (relevantFindings.length === 0) {
    return component === 'EXPERIENCE' ? 'No major issues found in the career record itself.' : 'No major issues found in the resume document itself.'
  }
  const topFinding = relevantFindings.reduce((worst, f) => (f.estimatedPointGain > worst.estimatedPointGain ? f : worst))
  return topFinding.candidateFacingCopy
}

async function getComponentDriverText(candidateId: string, component: MarketRealityComponent): Promise<string> {
  if (component === 'EXPERIENCE' || component === 'RESUME') {
    return getResumeAnalysisDriverText(candidateId, component)
  }

  const row = await prisma.marketRealityComponentScore.findUnique({
    where: { candidateId },
    select: { evidenceDrivers: true, marketDrivers: true, effortDrivers: true },
  })
  const fieldMap = { EVIDENCE: row?.evidenceDrivers, MARKET: row?.marketDrivers, EFFORT: row?.effortDrivers } as const
  const drivers = (fieldMap[component] as string[] | null) ?? []
  if (drivers.length === 0) return `No data yet for ${COMPONENT_LABEL[component]}.`
  // Market drivers are deliberately 2 sentences (cause + path, §3.5: "an F
  // on Market must never read as a dead end") — join both rather than
  // truncating to drivers[0], which would drop the path half and leave
  // only the cause, reading exactly like the dead end the spec forbids.
  return component === 'MARKET' ? drivers.join(' ') : drivers[0]
}

export async function buildMarketRealityHeadline(candidateId: string): Promise<MarketRealityHeadline | null> {
  const row = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId } })
  if (!row || row.compositeScore === null || !row.grade || !row.drivingComponent || !row.strongestComponent) {
    return null
  }

  const grade = row.grade as Grade
  const strongestComponent = row.strongestComponent as MarketRealityComponent
  const drivingComponent = row.drivingComponent as MarketRealityComponent

  const scores: Partial<Record<MarketRealityComponent, number>> = {
    EXPERIENCE: row.experienceScore ?? undefined,
    RESUME: row.resumeScore ?? undefined,
    EVIDENCE: row.evidenceScore ?? undefined,
    EFFORT: row.effortScore ?? undefined,
    MARKET: row.marketScore ?? undefined,
  }
  const strongestScore = scores[strongestComponent]
  if (strongestScore === undefined) return null // strongestComponent should always be measured, but never render off a guess
  const strongestGrade = scoreToGrade(strongestScore)

  const headline = `Market Reality: ${grade} — ${DIFFICULTY_LABEL[grade]}.`
  // Only claim "that part is working" when the strongest component is
  // genuinely strong (A/B) — echoing it for a merely-average strongest
  // component would be exactly the manufactured-warmth failure the Voice
  // spec calls out (§4.2: "never praise what isn't there").
  const strongestIsGenuinelyStrong = strongestGrade === 'A' || strongestGrade === 'B'
  const article = strongestGrade === 'A' ? 'an' : 'a'
  const strongestLine = `Your ${COMPONENT_LABEL[strongestComponent]} is ${article} ${strongestGrade}${strongestIsGenuinelyStrong ? ' — that part is working' : ''}.`
  const constraintLine = await getComponentDriverText(candidateId, drivingComponent)

  return { headline, strongestLine, constraintLine }
}
