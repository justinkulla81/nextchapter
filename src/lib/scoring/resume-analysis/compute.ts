// Orchestrator for the Record component — Market Reality Grade 2.0 Phase 2.
// Not yet wired into the live resume-upload flow (src/app/dashboard/resume/
// actions.ts still calls the legacy analyzeResume) — that wiring, plus
// browser verification against real uploads, happens once the composite
// grade (Phase 4) and report (Phase 7) exist to consume this output.
// Callable standalone today for the Phase 9 fixture harness.

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractResumeAnalysisFacts } from './extract-facts'
import { detectSeniorityBand } from './seniority-band'
import { detectFunctionFamily } from './function-family'
import { getDimensionWeights } from './weights'
import { computeAllDimensions } from './dimensions'
import { computeResumePrestige, computeReconciliation, computeExtracurricular } from './modifiers'
import { computeFirstGlance } from './first-glance'
import { detectReviewerQuestions } from './reviewer-questions'
import { simulateAtsCompatibility } from './ats-matrix'
import { selfCheckResumeAnalysis } from './self-check'
import { scoreToResumeBand } from './types'

export interface ComputeResumeAnalysisResult {
  resumeAnalysisId: string
  composite: number
  band: string
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
  const weights = getDimensionWeights(band)

  const { scores: dimensionScores, findings: dimensionFindings } = computeAllDimensions(facts, {
    band,
    family,
    targetRoleType: resume.candidate.targetRoleType,
    targetIndustries: resume.candidate.targetIndustries,
  })

  const prestige = await computeResumePrestige(facts)
  const reconciliation = computeReconciliation(facts)
  const extracurricular = computeExtracurricular(facts, band)

  const weightedSubtotal = Object.entries(dimensionScores).reduce((sum, [key, score]) => {
    return sum + (score * (weights[key as keyof typeof weights] ?? 0)) / 100
  }, 0)
  const composite = Math.max(
    0,
    Math.min(100, Math.round(weightedSubtotal + prestige.resumeGradeBonus + reconciliation.penalty + extracurricular.bonus))
  )
  const resumeBand = scoreToResumeBand(composite)

  const firstGlance = computeFirstGlance(facts, prestige.firstGlanceBonus)

  const check = selfCheckResumeAnalysis({
    dimensionScores,
    weights,
    prestigeBonus: prestige.resumeGradeBonus,
    reconciliationPenalty: reconciliation.penalty,
    extracurricularBonus: extracurricular.bonus,
    composite,
    band: resumeBand,
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
      composite,
      band: resumeBand,
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
  })

  return { resumeAnalysisId: analysis.id, composite, band: resumeBand }
}
