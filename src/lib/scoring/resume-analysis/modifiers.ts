// Prestige, reconciliation, and extracurricular — the three modifiers that
// sit outside the 10-dimension weighted sum (spec §3.2-3.4). Prestige and
// extracurricular are additive-only bonuses; reconciliation is a
// penalty-only deduction. None of the three may push the composite outside
// its own cap — enforced by the caller (compute.ts), not here.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ResumeAnalysisFacts } from './extract-facts'
import type { SeniorityBand } from './types'
import type { IssueCode } from '@/lib/analytics/issue-taxonomy'

// ── Prestige (spec §4.13) — 0 to +6 on the Record composite, 0 to +10 on
// First Glance. Never negative, never displayed, logged to PrestigeAudit.
// Reuses the same admin-curated EliteInstitution/PrestigeEmployer tables as
// the legacy six-category system's pedigree-bonus.ts, via new matching
// logic that rescales to this spec's caps and applies recency decay (the
// legacy bonus doesn't decay).
const RESUME_GRADE_PRESTIGE_CAP = 6
const FIRST_GLANCE_PRESTIGE_CAP = 10
const RAW_INSTITUTION_POINTS = 8
const RAW_EMPLOYER_POINTS = 8

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export interface PrestigeComputation {
  resumeGradeBonus: number
  firstGlanceBonus: number
  employerTierPoints: number
  institutionTierPoints: number
  recencyDecayApplied: boolean
}

export async function computeResumePrestige(facts: ResumeAnalysisFacts): Promise<PrestigeComputation> {
  const [eliteInstitutions, prestigeEmployers] = await Promise.all([
    prisma.eliteInstitution.findMany({ where: { isActive: true } }),
    prisma.prestigeEmployer.findMany({ where: { isActive: true } }),
  ])

  const institutionNames = new Set(facts.education.map((e) => normalize(e.schoolName)))
  const matchedInstitution = eliteInstitutions.find((i) => institutionNames.has(normalize(i.nameNormalized)))
  const institutionTierPoints = matchedInstitution ? RAW_INSTITUTION_POINTS : 0

  const employerNames = new Set(facts.roles.map((r) => normalize(r.company)))
  const matchedEmployer = prestigeEmployers.find((e) => employerNames.has(normalize(e.nameNormalized)))
  const employerTierPoints = matchedEmployer ? RAW_EMPLOYER_POINTS : 0

  // Recency decay — spec §4.13: "a 25-year-old degree contributes less
  // than a recent one." Applied to the institution component only (the
  // employer component's recency is already implicitly captured by
  // whether the employer appears in a recent role at all).
  const gradYear = facts.education.find((e) => normalize(e.schoolName) === normalize(matchedInstitution?.nameNormalized ?? ''))
    ?.graduationDate
  const yearsSinceGrad = gradYear ? (Date.now() - new Date(gradYear).getTime()) / (1000 * 60 * 60 * 24 * 365) : 0
  const decayFactor = yearsSinceGrad > 20 ? 0.4 : yearsSinceGrad > 10 ? 0.7 : 1
  const decayedInstitutionPoints = institutionTierPoints * decayFactor

  const rawTotal = decayedInstitutionPoints + employerTierPoints

  return {
    resumeGradeBonus: Math.min(RESUME_GRADE_PRESTIGE_CAP, Math.round(rawTotal * (RESUME_GRADE_PRESTIGE_CAP / (RAW_INSTITUTION_POINTS + RAW_EMPLOYER_POINTS)))),
    firstGlanceBonus: Math.min(FIRST_GLANCE_PRESTIGE_CAP, Math.round(rawTotal * (FIRST_GLANCE_PRESTIGE_CAP / (RAW_INSTITUTION_POINTS + RAW_EMPLOYER_POINTS)))),
    employerTierPoints,
    institutionTierPoints,
    recencyDecayApplied: decayFactor < 1,
  }
}

// ── Reconciliation & Integrity (spec §4.11) — penalty only, -12 to 0.
export interface ReconciliationFinding {
  candidateFacingCopy: string
  penalty: number
  // Stable analytics code — see this Finding-shaped interface's sibling,
  // resume-analysis/types.ts's Finding.issueCode, and
  // src/lib/analytics/issue-taxonomy.ts for the registry. All four
  // reconciliation checks below are 'reconciliation'-category codes, which
  // apply to the Resume composite only (see this module's own comment on
  // the reconciliation penalty).
  issueCode: IssueCode
}

export function computeReconciliation(facts: ResumeAnalysisFacts): { penalty: number; findings: ReconciliationFinding[] } {
  const findings: ReconciliationFinding[] = []
  let penalty = 0

  // Overlapping full-time roles.
  const dated = facts.roles
    .filter((r) => r.startDate && !r.isInternship)
    .map((r) => ({
      start: new Date(r.startDate as string).getTime(),
      end: r.endDate ? new Date(r.endDate).getTime() : Date.now(),
      title: r.title,
    }))
    .sort((a, b) => a.start - b.start)

  for (let i = 1; i < dated.length; i++) {
    if (dated[i].start < dated[i - 1].end - 1000 * 60 * 60 * 24 * 30) {
      // more than ~30 days of overlap
      findings.push({
        candidateFacingCopy: `${dated[i - 1].title} and ${dated[i].title} overlap by more than a month.`,
        penalty: -3,
        issueCode: 'overlapping_full_time',
      })
      penalty -= 3
    }
  }

  // Credential without a granting institution.
  const missingInstitution = facts.education.filter((e) => !e.hasGrantingInstitution)
  if (missingInstitution.length > 0) {
    findings.push({
      candidateFacingCopy: `${missingInstitution[0].degree ?? 'A credential'} is listed without the granting institution.`,
      penalty: -2,
      issueCode: 'credential_without_institution',
    })
    penalty -= 2
  }

  // Stated years of experience vs. actual timeline.
  if (facts.statedYearsExperience !== null && dated.length > 0) {
    const earliest = Math.min(...dated.map((d) => d.start))
    const latest = Math.max(...dated.map((d) => d.end))
    const actualYears = (latest - earliest) / (1000 * 60 * 60 * 24 * 365)
    if (Math.abs(actualYears - facts.statedYearsExperience) > 2) {
      findings.push({
        candidateFacingCopy: `Your summary states ${facts.statedYearsExperience} years; your dates show roughly ${Math.round(actualYears)}.`,
        penalty: -3,
        issueCode: 'years_experience_mismatch',
      })
      penalty -= 3
    }
  }

  if (!facts.summaryClaimsOverlapWithTimeline) {
    findings.push({
      candidateFacingCopy: 'A claim in your summary doesn\'t line up with your role timeline.',
      penalty: -2,
      issueCode: 'tenure_date_mismatch',
    })
    penalty -= 2
  }

  return { penalty: Math.max(-12, penalty), findings }
}

// ── Extracurricular & Outside Leadership (spec §4.12) — bonus, 0 to +3.
// Governance-type entries (board seats, association leadership) hold value
// across bands; general volunteer/other leadership decays by band — this
// reconciles the single-bonus cap in the spec with the governance-vs-
// general distinction the earlier build script called out, without
// exceeding the spec's 0-3 cap or double-counting anything.
const BAND_EXTRACURRICULAR_DECAY: Record<SeniorityBand, number> = {
  EARLY: 1,
  MID: 0.7,
  SENIOR: 0.4,
  EXECUTIVE: 0.3,
}
const GOVERNANCE_KINDS = new Set(['BOARD_SEAT', 'ASSOCIATION_LEADERSHIP'])

export function computeExtracurricular(facts: ResumeAnalysisFacts, band: SeniorityBand): { bonus: number; count: number } {
  let raw = 0
  for (const entry of facts.extracurricular) {
    if (entry.kind === 'GENERIC_VOLUNTEER') continue // spec: generic entries score zero, not negative
    const points = GOVERNANCE_KINDS.has(entry.kind) ? 1.5 : 1
    const decay = GOVERNANCE_KINDS.has(entry.kind) ? 1 : BAND_EXTRACURRICULAR_DECAY[band]
    raw += points * decay
  }
  return { bonus: Math.min(3, Math.round(raw)), count: facts.extracurricular.filter((e) => e.kind !== 'GENERIC_VOLUNTEER').length }
}
