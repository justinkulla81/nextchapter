// Orchestrator for the Your Experience / Your Resume components — Market
// Reality Grade 2.0 Phase 2, restructured per Master Build Script §3.1/§18:
// what was one "Record" composite over 10 blended dimensions is now two
// independent composites, each with its own weighted subtotal and its own
// modifiers (extracurricular -> Experience; prestige + reconciliation ->
// Resume). Not yet wired into the live resume-upload flow
// (src/app/dashboard/resume/actions.ts still calls the legacy
// analyzeResume) — that wiring, plus browser verification against real
// uploads, happens once the 5-component composite grade (§3.6) and report
// (§11) exist to consume this output. Callable standalone today for the
// fixture harness (§16).

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractResumeAnalysisFacts } from './extract-facts'
import { detectSeniorityBand } from './seniority-band'
import { detectFunctionFamily } from './function-family'
import { getExperienceDimensionWeights, getResumeDimensionWeights } from './weights'
import { computeAllDimensions } from './dimensions'
import { computeResumePrestige, computeReconciliation, computeExtracurricular, computeExperienceTrajectoryBonus } from './modifiers'
import { computeFirstGlance } from './first-glance'
import { detectReviewerQuestions } from './reviewer-questions'
import { simulateAtsCompatibility } from './ats-matrix'
import { selfCheckResumeAnalysis } from './self-check'
import { scoreToExperienceBand, scoreToResumeBand } from './types'
import { captureResumeIssues } from '@/lib/analytics/capture-resume-issues'

export interface ComputeResumeAnalysisResult {
  resumeAnalysisId: string
  experienceScore: number
  experienceBand: string
  resumeScore: number
  resumeBand: string
}

export async function computeResumeAnalysis(resumeId: string): Promise<ComputeResumeAnalysisResult | null> {
  const resume = await prisma.resume.findUniqueOrThrow({
    where: { id: resumeId },
    include: { candidate: { select: { id: true, targetRoleType: true, targetIndustries: true } } },
  })

  if (!resume.extractedText) return null

  const facts = await extractResumeAnalysisFacts(resume.extractedText)
  if (!facts) return null

  const band = detectSeniorityBand(facts)
  const family = detectFunctionFamily(facts)
  const experienceWeights = getExperienceDimensionWeights(band)
  const resumeWeights = getResumeDimensionWeights(band)

  const { scores: dimensionScores, findings: dimensionFindings } = computeAllDimensions(facts, {
    band,
    family,
    targetRoleType: resume.candidate.targetRoleType,
    targetIndustries: resume.candidate.targetIndustries,
  })

  const prestige = await computeResumePrestige(facts)
  const reconciliation = computeReconciliation(facts)
  const extracurricular = computeExtracurricular(facts, band)
  const trajectoryBonus = computeExperienceTrajectoryBonus(facts)

  const experienceSubtotal = Object.entries(experienceWeights).reduce((sum, [key, weight]) => {
    return sum + (dimensionScores[key as keyof typeof dimensionScores] * weight) / 100
  }, 0)
  const experienceScore = Math.max(
    0,
    Math.min(100, Math.round(experienceSubtotal + extracurricular.bonus + trajectoryBonus.bonus))
  )
  const experienceBand = scoreToExperienceBand(experienceScore)

  const resumeSubtotal = Object.entries(resumeWeights).reduce((sum, [key, weight]) => {
    return sum + (dimensionScores[key as keyof typeof dimensionScores] * weight) / 100
  }, 0)
  const resumeScore = Math.max(
    0,
    Math.min(100, Math.round(resumeSubtotal + prestige.resumeGradeBonus + reconciliation.penalty))
  )
  const resumeBand = scoreToResumeBand(resumeScore)

  const firstGlance = computeFirstGlance(facts, prestige.firstGlanceBonus)

  const check = selfCheckResumeAnalysis({
    dimensionScores,
    experienceWeights,
    resumeWeights,
    extracurricularBonus: extracurricular.bonus,
    experienceTrajectoryBonus: trajectoryBonus.bonus,
    prestigeBonus: prestige.resumeGradeBonus,
    reconciliationPenalty: reconciliation.penalty,
    experienceScore,
    experienceBand,
    resumeScore,
    resumeBand,
    firstGlanceScore: firstGlance.score,
  })
  if (!check.passed) {
    // Fail closed — never persist (let alone render) a score that doesn't
    // reconcile with its own inputs. Logged for investigation rather than
    // silently shipping a wrong number, per invariant #5.
    console.error('ResumeAnalysis self-check failed:', check.errors)
    return null
  }

  const reviewerDetections = detectReviewerQuestions(facts, band)
  const atsMatrix = simulateAtsCompatibility(facts)

  const analysis = await prisma.resumeAnalysis.create({
    data: {
      resumeId,
      candidateId: resume.candidateId,
      seniorityBand: band,
      functionFamily: family,
      dimensionScores: dimensionScores as unknown as Prisma.InputJsonValue,
      dimensionFindings: dimensionFindings as unknown as Prisma.InputJsonValue,
      prestigeBonus: prestige.resumeGradeBonus,
      reconciliationPenalty: reconciliation.penalty,
      extracurricularBonus: extracurricular.bonus,
      experienceScore,
      experienceBand,
      resumeScore,
      resumeBand,
      firstGlanceScore: firstGlance.score,
      firstGlanceResult: firstGlance.result,
      firstGlanceTopFix: firstGlance.topFix,
      prestigeAudit: {
        create: {
          employerTierPoints: prestige.employerTierPoints,
          institutionTierPoints: prestige.institutionTierPoints,
          recencyDecayApplied: prestige.recencyDecayApplied,
          totalAwarded: prestige.resumeGradeBonus,
        },
      },
      reviewerQuestions: {
        create: reviewerDetections.map((d) => ({
          candidate: { connect: { id: resume.candidateId } },
          detectionType: d.detectionType,
          detectedContext: d.detectedContext as unknown as Prisma.InputJsonValue,
        })),
      },
      atsParseResults: {
        create: atsMatrix.map((row) => ({
          parserKey: row.parserKey,
          parserLabel: row.parserLabel,
          fieldsExpected: row.fieldsExpected,
          fieldsRecovered: row.fieldsRecovered,
          failures: row.failures as unknown as Prisma.InputJsonValue,
          severity: row.severity,
        })),
      },
    },
    include: { reviewerQuestions: true },
  })

  // Part B Prompt 3 — explode this analysis's detections into the
  // ResumeIssue analytics spine. Every input here is already in scope from
  // this same function (dimensionFindings/reconciliation.findings now carry
  // issueCode per Prompt 1; analysis.reviewerQuestions are the rows just
  // created above, with real ids) — see capture-resume-issues.ts for why
  // this happens here rather than after computeResumeAnalysis() returns.
  await captureResumeIssues({
    candidateId: resume.candidateId,
    resumeAnalysisId: analysis.id,
    dimensionFindings,
    reconciliationFindings: reconciliation.findings,
    reviewerQuestions: analysis.reviewerQuestions,
  })

  return { resumeAnalysisId: analysis.id, experienceScore, experienceBand, resumeScore, resumeBand }
}
