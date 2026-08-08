import 'server-only'
import { prisma } from '@/lib/prisma'
import { HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import type { PromotionVelocity } from '@prisma/client'

interface WorkHistoryVelocityInput {
  roleTitle: string
  startDate: Date
  endDate: Date | null
}

const ELITE_INSTITUTION_BONUS = 10
const PRESTIGE_EMPLOYER_BONUS = 10
const HIGH_DEMAND_SIGNAL_BONUS = 8
const PROMOTION_VELOCITY_BONUS: Record<PromotionVelocity, number> = {
  STEADY: 0,
  RAPID: 6,
  EXCEPTIONAL: 12,
}
const MAX_PEDIGREE_BONUS = 25

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function isInternshipRole(entry: WorkHistoryVelocityInput): boolean {
  return /intern/i.test(entry.roleTitle)
}

// Level-jumps per year across real (non-internship) jobs. First-pass
// magnitudes — tune after seeing this against real seeded candidates, same
// caveat as detectCareerTrajectory in work-history-facts.ts. Distinct from
// that function's PROMOTED/STABLE/DEMOTED (which only reads direction, not
// speed) — this reads speed specifically, and only ever adds to Target Fit,
// never touching the existing Ownership PROMOTED/DEMOTED adjustment.
export function computePromotionVelocity(workHistory: WorkHistoryVelocityInput[]): PromotionVelocity | null {
  const real = workHistory.filter((entry) => !isInternshipRole(entry))
  if (real.length < 2) return null

  const sorted = [...real].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const levels = HIGHEST_LEVEL_OPTIONS as readonly string[]
  const indices = sorted.map((entry) => levels.indexOf(inferLevelFromTitle(entry.roleTitle)))

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const levelGain = indices[indices.length - 1] - indices[0]
  if (levelGain <= 0) return null

  const referenceEnd = last.endDate ?? new Date()
  const yearsSpan = Math.max(1, (referenceEnd.getTime() - first.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365))
  const velocity = levelGain / yearsSpan

  if (velocity >= 1) return 'EXCEPTIONAL'
  if (velocity >= 0.5) return 'RAPID'
  return 'STEADY'
}

export interface PedigreeSignals {
  eliteInstitution: string | null
  prestigeEmployer: string | null
  highDemandSignal: string | null
  promotionVelocity: PromotionVelocity | null
}

export interface PedigreeResult {
  bonus: number
  promotionVelocity: PromotionVelocity | null
  signals: PedigreeSignals
}

// Matched against the admin-curated EliteInstitution/PrestigeEmployer/
// HighDemandSignal lists (managed at /support/admin/pedigree-signals).
// Additive only — a candidate with no matching signal gets bonus: 0 and is
// otherwise unaffected, same treatment as the real-event bumps in
// rewrite-actions.ts (interview landed, offer, etc.), never a change to how
// Target Fit's existing four-way average is divided.
export async function computePedigreeBonus(candidateId: string): Promise<PedigreeResult> {
  const [candidate, education, workHistory, eliteInstitutions, prestigeEmployers, highDemandSignals] =
    await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({
        where: { id: candidateId },
        select: { primaryFunction: true, targetRoleType: true, resumeLatestJobTitle: true },
      }),
      prisma.educationEntry.findMany({ where: { candidateId }, select: { schoolNameNormalized: true } }),
      prisma.workHistoryEntry.findMany({
        where: { candidateId },
        select: { companyName: true, roleTitle: true, startDate: true, endDate: true },
      }),
      prisma.eliteInstitution.findMany({ where: { isActive: true } }),
      prisma.prestigeEmployer.findMany({ where: { isActive: true } }),
      prisma.highDemandSignal.findMany({ where: { isActive: true } }),
    ])

  let bonus = 0
  const signals: PedigreeSignals = {
    eliteInstitution: null,
    prestigeEmployer: null,
    highDemandSignal: null,
    promotionVelocity: null,
  }

  const educationNames = new Set(education.map((e) => normalize(e.schoolNameNormalized)))
  const matchedInstitution = eliteInstitutions.find((i) => educationNames.has(normalize(i.nameNormalized)))
  if (matchedInstitution) {
    bonus += ELITE_INSTITUTION_BONUS
    signals.eliteInstitution = matchedInstitution.name
  }

  const employerNames = new Set(workHistory.map((w) => normalize(w.companyName)))
  const matchedEmployer = prestigeEmployers.find((e) => employerNames.has(normalize(e.nameNormalized)))
  if (matchedEmployer) {
    bonus += PRESTIGE_EMPLOYER_BONUS
    signals.prestigeEmployer = matchedEmployer.name
  }

  const haystack = normalize(
    [candidate.primaryFunction, candidate.targetRoleType, candidate.resumeLatestJobTitle].filter(Boolean).join(' ')
  )
  const matchedSignal = highDemandSignals.find((s) => s.keywords.some((kw) => haystack.includes(normalize(kw))))
  if (matchedSignal) {
    bonus += HIGH_DEMAND_SIGNAL_BONUS
    signals.highDemandSignal = matchedSignal.label
  }

  const promotionVelocity = computePromotionVelocity(
    workHistory.map((w) => ({ roleTitle: w.roleTitle, startDate: w.startDate, endDate: w.endDate }))
  )
  if (promotionVelocity) {
    bonus += PROMOTION_VELOCITY_BONUS[promotionVelocity]
    signals.promotionVelocity = promotionVelocity
  }

  return {
    bonus: Math.min(bonus, MAX_PEDIGREE_BONUS),
    promotionVelocity,
    signals,
  }
}
