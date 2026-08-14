// The 11-dimension catalog — Resume Scoring Spec §4, extended by Master
// Build Script §3.1 (renamed evidenceQuality->quantification, added
// industryCoherence). Each function takes
// the extracted facts + candidate context and returns a 0-100 score plus
// candidate-facing findings. Deterministic wherever the facts allow (spec
// §8.1: "every narrative sentence must be traceable to a dimension
// result") — only narrativePositioning and mechanicsPresentation take
// their score directly from the extraction pass (extract-facts.ts), since
// those two have no deterministic proxy per spec §4.2/§4.8.

import type { ResumeAnalysisFacts } from './extract-facts'
import { getFunctionFamilyDefinition } from './weights'
import type { DimensionFindings, DimensionKey, DimensionScores, FunctionFamily, Finding, SeniorityBand } from './types'

function normalizeIndustry(value: string): string {
  return value.trim().toLowerCase()
}

export interface DimensionContext {
  band: SeniorityBand
  family: FunctionFamily
  targetRoleType: string | null
  targetIndustries: string[]
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function scopeMagnitude(role: ResumeAnalysisFacts['roles'][number]): number {
  if (role.budgetOrPnlUsd) return role.budgetOrPnlUsd
  if (role.quotaUsd) return role.quotaUsd * 3
  if (role.headcount) return role.headcount * 200_000
  return 0
}

// ── Quantification (Your Resume) — renamed from "Evidence Quality" per
// Master Build Script §3.1/§18: the old name collided with the new "Your
// Evidence" component, which measures something unrelated (third-party
// corroboration). This dimension is unchanged in substance — outcome-vs-
// activity, baselines present, density — all classified per bullet during
// extraction. Function-adjusted: an engineer with no revenue numbers is not
// deficient, because "hasAnyNumber" already credits any stated metric
// (systems scale, latency, uptime), not revenue specifically.
function scoreQuantification(facts: ResumeAnalysisFacts, ctx: DimensionContext): { score: number; findings: Finding[] } {
  const allBullets = facts.roles.flatMap((r, i) => r.bullets.map((b) => ({ ...b, roleIndex: i })))
  if (allBullets.length === 0) return { score: 40, findings: [] }

  const recentBullets = allBullets.filter((b) => b.roleIndex <= 1) // most recent two roles weighted higher, per spec's "weighted toward recent roles"
  const outcomeRatio = allBullets.filter((b) => b.isOutcomeNotActivity).length / allBullets.length
  const baselineRatio = allBullets.filter((b) => b.hasBaselinePair).length / allBullets.length
  const numberDensity = allBullets.filter((b) => b.hasAnyNumber).length / allBullets.length
  const recentOutcomeRatio = recentBullets.length
    ? recentBullets.filter((b) => b.isOutcomeNotActivity).length / recentBullets.length
    : outcomeRatio

  const score = outcomeRatio * 40 + baselineRatio * 25 + numberDensity * 15 + recentOutcomeRatio * 20

  const findings: Finding[] = []
  const activityBullet = allBullets.find((b) => !b.isOutcomeNotActivity && !b.hasAnyNumber)
  if (activityBullet && outcomeRatio < 0.6) {
    findings.push({
      severity: 'HIGH',
      candidateFacingCopy: `"${activityBullet.text}" describes a duty, not a result. Reviewers skim past bullets like this.`,
      fix: 'Add the number: what changed, from what, to what.',
      estimatedPointGain: 8,
    })
  }
  if (baselineRatio < 0.2 && allBullets.length >= 5) {
    findings.push({
      severity: 'MEDIUM',
      candidateFacingCopy: 'Most of your quantified bullets state a single number rather than a from/to pair — the strongest form of evidence.',
      fix: 'Where you can, show the baseline: "from $X to $Y" beats "grew 40%."',
      estimatedPointGain: 5,
    })
  }

  const familyDef = getFunctionFamilyDefinition(ctx.family)
  if (numberDensity < 0.3 && familyDef.doNotExpect.length === 0) {
    findings.push({
      severity: 'HIGH',
      candidateFacingCopy: 'Fewer than a third of your bullets carry a number of any kind.',
      fix: 'Every bullet should end with a measurable result, even an estimate.',
      estimatedPointGain: 10,
    })
  }

  return { score: clamp(score), findings }
}

// ── 4.2 Narrative & Positioning — 15 ─────────────────────────────────────
// Genuinely qualitative — no deterministic proxy — scored directly by the
// extraction pass. This function just packages the score with findings.
function scoreNarrativePositioning(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const findings: Finding[] = []
  if (!facts.targetStatedOrInferable) {
    findings.push({
      severity: 'HIGH',
      candidateFacingCopy: 'Your resume records what you\'ve done but never says what you want next.',
      fix: 'Add a target line under your name: role, level, industry, company size.',
      estimatedPointGain: 12,
    })
  } else if (!facts.hasSummary || !facts.summaryIsForwardLooking) {
    findings.push({
      severity: 'MEDIUM',
      candidateFacingCopy: 'Your target is inferable, but nothing at the top of the document states it plainly.',
      fix: 'Make the target explicit in one line — don\'t make a reviewer infer it.',
      estimatedPointGain: 6,
    })
  }
  return { score: clamp(facts.narrativePositioningScore), findings }
}

// ── 4.3 ATS Legibility & File Hygiene — 15 ───────────────────────────────
function scoreAtsLegibility(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const hardFailure = facts.atsFlags.find((f) => f.isHardFailure)
  const findings: Finding[] = []

  if (hardFailure) {
    findings.push({
      severity: 'HIGH',
      candidateFacingCopy: `${hardFailure.detail} — this causes near-total parse loss in most applicant tracking systems.`,
      fix: 'Rebuild this section as plain single-column text, no tables or embedded graphics.',
      estimatedPointGain: 20,
    })
    return { score: clamp(Math.min(25, 25 - facts.atsFlags.filter((f) => f.isHardFailure).length * 5)), findings }
  }

  const softFailures = facts.atsFlags.filter((f) => !f.isHardFailure)
  const score = 100 - softFailures.length * 12
  for (const flag of softFailures.slice(0, 3)) {
    findings.push({
      severity: 'MEDIUM',
      candidateFacingCopy: flag.detail,
      fix: 'Standard spacing, standard section names, embedded standard fonts.',
      estimatedPointGain: 4,
    })
  }
  return { score: clamp(score), findings }
}

// ── 4.4 Scope & Level — 12 ────────────────────────────────────────────────
// Scored from stated numbers against band norms — never from title. Bands
// widen the norms as they go up; a $5M P&L is strong for Mid, unremarkable
// for Executive.
const SCOPE_BAND_NORM: Record<SeniorityBand, number> = {
  EARLY: 100_000,
  MID: 3_000_000,
  SENIOR: 30_000_000,
  EXECUTIVE: 300_000_000,
}

function scoreScopeLevel(facts: ResumeAnalysisFacts, ctx: DimensionContext): { score: number; findings: Finding[] } {
  const maxScope = Math.max(0, ...facts.roles.map(scopeMagnitude))
  const norm = SCOPE_BAND_NORM[ctx.band]
  const findings: Finding[] = []

  if (maxScope === 0) {
    findings.push({
      severity: 'HIGH',
      candidateFacingCopy: 'No role states a budget, headcount, quota, or reporting scope — reviewers can\'t size your responsibility from the numbers alone.',
      fix: 'Add at least one scope number per recent role: budget, team size, or geography.',
      estimatedPointGain: 8,
    })
    return { score: 45, findings }
  }

  const ratio = maxScope / norm
  const score = ratio >= 1.5 ? 95 : ratio >= 1 ? 82 : ratio >= 0.5 ? 65 : ratio >= 0.2 ? 50 : 35
  return { score: clamp(score), findings }
}

// ── 4.5 Trajectory — 10 ───────────────────────────────────────────────────
// Compares consecutive roles on scope magnitude, never title rank — the
// exact fix for the known EVP/President defect (spec §4.5, §10.1).
function scoreTrajectory(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const sorted = [...facts.roles]
    .filter((r) => r.startDate && !r.isInternship)
    .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime())

  if (sorted.length < 2) return { score: 70, findings: [] }

  let increases = 0
  let decreases = 0
  for (let i = 1; i < sorted.length; i++) {
    const prev = scopeMagnitude(sorted[i - 1])
    const cur = scopeMagnitude(sorted[i])
    if (prev === 0 || cur === 0) continue // no comparable scope data for this pair — skip, never penalize for missing data
    if (cur > prev * 1.15) increases++
    else if (cur < prev * 0.85) decreases++
  }

  const comparablePairs = increases + decreases
  if (comparablePairs === 0) return { score: 65, findings: [] }

  const score = 50 + (increases / comparablePairs) * 50 - (decreases / comparablePairs) * 15
  return { score: clamp(score), findings: [] } // apparent decreases surface as SCOPE_DECREASE reviewer questions, not a narrated deduction here
}

// ── 4.6 Tenure Pattern — 8 ────────────────────────────────────────────────
// Industry-relative — never a global constant. Uses a per-family threshold
// approximation (spec: "two years is unremarkable in tech, alarming in
// law") — tech/product/engineering get an 18-month floor, everything else
// 24 months, matching the spec's own worked comparison.
const SHORT_TENURE_MONTHS: Record<FunctionFamily, number> = {
  ENGINEERING: 18,
  PRODUCT: 18,
  REVENUE: 18,
  MARKETING: 18,
  GENERAL_MANAGEMENT: 24,
  FINANCE: 24,
  OPERATIONS: 24,
  PEOPLE: 24,
  LEGAL: 30,
  CLINICAL: 30,
}

function roleTenureMonths(role: ResumeAnalysisFacts['roles'][number]): number | null {
  if (!role.startDate) return null
  const start = new Date(role.startDate).getTime()
  const end = role.endDate ? new Date(role.endDate).getTime() : Date.now()
  return (end - start) / (1000 * 60 * 60 * 24 * 30)
}

function scoreTenurePattern(facts: ResumeAnalysisFacts, ctx: DimensionContext): { score: number; findings: Finding[] } {
  const threshold = SHORT_TENURE_MONTHS[ctx.family]
  const real = facts.roles.filter((r) => !r.isInternship && r.startDate)
  if (real.length === 0) return { score: 70, findings: [] }

  const tenures = real.map((r) => roleTenureMonths(r)).filter((t): t is number => t !== null)
  const shortCount = tenures.filter((t) => t < threshold).length
  const shortRatio = shortCount / tenures.length

  const score = 100 - shortRatio * 60
  const findings: Finding[] = []
  if (shortRatio > 0.4) {
    findings.push({
      severity: 'MEDIUM',
      candidateFacingCopy: 'Several roles run shorter than typical for your function.',
      fix: 'This is worth addressing directly — see "How a recruiter will read this" below.',
      estimatedPointGain: 0, // explanation neutralizes the reviewer-question effect, not this dimension's score directly
    })
  }
  return { score: clamp(score), findings }
}

// ── 4.7 Relevance & Recency — 5 ───────────────────────────────────────────
function scoreRelevanceRecency(facts: ResumeAnalysisFacts, ctx: DimensionContext): { score: number; findings: Finding[] } {
  if (!ctx.targetRoleType) return { score: 60, findings: [] } // no target — score coherence proxy only, per spec §4.7

  const now = Date.now()
  let weightedRelevance = 0
  let totalWeight = 0
  for (const role of facts.roles) {
    if (!role.startDate) continue
    const yearsAgo = (now - new Date(role.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
    const decay = yearsAgo <= 3 ? 1 : yearsAgo <= 8 ? 0.5 : 0.1
    const relevance = role.title.toLowerCase().includes((ctx.targetRoleType ?? '').toLowerCase().split(' ')[0] ?? '') ? 1 : 0.4
    weightedRelevance += relevance * decay
    totalWeight += decay
  }
  const score = totalWeight > 0 ? (weightedRelevance / totalWeight) * 100 : 60
  return { score: clamp(score), findings: [] }
}

// ── Industry Coherence (Your Experience) — new per Master Build Script
// §3.1/§18. Measures how tightly a career clusters around related
// industries, not whether any one industry is "better." Scored from the
// employer industry extracted per role — recency-weighted, same decay
// shape as Relevance & Recency, so a candidate who spent their most recent
// years in one industry after an early pivot reads as coherent now, not
// penalized for the pivot itself. Roles with no extracted industry are
// simply excluded from the count, never treated as a mismatch.
function scoreIndustryCoherence(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const withIndustry = facts.roles.filter((r) => r.industry && !r.isInternship)
  if (withIndustry.length < 2) {
    // Not enough data to measure coherence one way or the other — neutral,
    // never a penalty for something the extraction couldn't determine.
    return { score: 60, findings: [] }
  }

  const now = Date.now()
  const weightByIndustry = new Map<string, number>()
  let totalWeight = 0
  for (const role of withIndustry) {
    const industry = normalizeIndustry(role.industry as string)
    const yearsAgo = role.startDate ? (now - new Date(role.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365) : 5
    const weight = yearsAgo <= 3 ? 1 : yearsAgo <= 8 ? 0.5 : 0.2
    weightByIndustry.set(industry, (weightByIndustry.get(industry) ?? 0) + weight)
    totalWeight += weight
  }

  const pluralityWeight = Math.max(...weightByIndustry.values())
  const pluralityShare = totalWeight > 0 ? pluralityWeight / totalWeight : 1
  const distinctIndustries = weightByIndustry.size

  // A single-industry career scores highest; a clear recent plurality after
  // an earlier pivot still scores well; a career with no dominant thread
  // scores lowest — but never punitively, since some functions (consulting,
  // interim/fractional work) legitimately span industries by design.
  const score = distinctIndustries === 1 ? 95 : 40 + pluralityShare * 55

  return { score: clamp(score), findings: [] } // informational only — never narrated as a deficiency (spec §17: never imply a candidate's background is insufficient)
}

// ── 4.8 Mechanics & Presentation — 10 ─────────────────────────────────────
// Holistic score from extraction; itemized mechanicsIssues become findings.
function scoreMechanicsPresentation(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const findings: Finding[] = facts.mechanicsIssues.slice(0, 4).map((issue) => ({
    severity: issue.kind === 'TYPO' ? 'HIGH' : 'LOW',
    candidateFacingCopy: `"${issue.quote}" — ${issue.location}.`,
    fix:
      issue.kind === 'TYPO'
        ? 'Fix the spelling.'
        : issue.kind === 'TENSE_INCONSISTENCY'
          ? 'Present tense for your current role, past tense for prior ones.'
          : issue.kind === 'WEAK_VERB'
            ? 'Lead with an action verb: led, owned, built, shipped.'
            : 'Mechanical fix — see the resume updater for a one-click correction.',
    estimatedPointGain: issue.kind === 'TYPO' ? 3 : 1,
  }))
  return { score: clamp(facts.mechanicsPresentationScore), findings }
}

// ── 4.9 Skill & Vocabulary Currency — 3 ───────────────────────────────────
function scoreSkillCurrency(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const current = facts.currentTerminologyFound.length
  const stale = facts.staleTerminologyFound.length
  const score = 60 + current * 6 - stale * 8
  const findings: Finding[] = []
  if (stale > 0) {
    findings.push({
      severity: 'LOW',
      candidateFacingCopy: `Terms like "${facts.staleTerminologyFound[0]}" read as dated for your function.`,
      fix: 'Swap in the current vocabulary for the same skill.',
      estimatedPointGain: 2,
    })
  }
  return { score: clamp(score), findings }
}

// ── 4.10 Contactability — 2 ───────────────────────────────────────────────
function scoreContactability(facts: ResumeAnalysisFacts): { score: number; findings: Finding[] } {
  const present = [facts.hasEmail, facts.hasPhone, facts.hasLinkedIn, facts.hasLocation].filter(Boolean).length
  const score = (present / 4) * 100
  const findings: Finding[] = []
  if (!facts.hasLinkedIn) {
    findings.push({
      severity: 'LOW',
      candidateFacingCopy: 'No LinkedIn URL on the document.',
      fix: 'Add your LinkedIn profile URL near your contact info.',
      estimatedPointGain: 1,
    })
  }
  if (facts.emailNameMismatch) {
    findings.push({
      severity: 'LOW',
      candidateFacingCopy: 'The email on your resume doesn\'t match your name — worth a look, ignore if intentional.',
      fix: 'Confirm this is the email you want reviewers to use.',
      estimatedPointGain: 0,
    })
  }
  return { score: clamp(score), findings }
}

export function computeAllDimensions(
  facts: ResumeAnalysisFacts,
  ctx: DimensionContext
): { scores: DimensionScores; findings: DimensionFindings } {
  const results: Record<DimensionKey, { score: number; findings: Finding[] }> = {
    quantification: scoreQuantification(facts, ctx),
    narrativePositioning: scoreNarrativePositioning(facts),
    atsLegibility: scoreAtsLegibility(facts),
    scopeLevel: scoreScopeLevel(facts, ctx),
    trajectory: scoreTrajectory(facts),
    mechanicsPresentation: scoreMechanicsPresentation(facts),
    tenurePattern: scoreTenurePattern(facts, ctx),
    relevanceRecency: scoreRelevanceRecency(facts, ctx),
    industryCoherence: scoreIndustryCoherence(facts),
    skillCurrency: scoreSkillCurrency(facts),
    contactability: scoreContactability(facts),
  }

  const scores = Object.fromEntries(
    (Object.entries(results) as [DimensionKey, { score: number; findings: Finding[] }][]).map(([k, v]) => [k, v.score])
  ) as DimensionScores
  const findings = Object.fromEntries(
    (Object.entries(results) as [DimensionKey, { score: number; findings: Finding[] }][]).map(([k, v]) => [k, v.findings])
  ) as DimensionFindings

  return { scores, findings }
}
