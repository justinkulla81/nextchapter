// "What a reviewer will ask about" — spec §7. Same detections as a
// red-flag scan, opposite register: framed as interview prep, never as a
// defect list. Each detection here becomes a ReviewerQuestion row; the
// candidate's Search Action Task explanation neutralizes it — see the
// model's own comment in schema.prisma for exactly what "neutralizes"
// does and doesn't touch (never the reconciliation penalty).

import type { ResumeAnalysisFacts } from './extract-facts'
import type { ReviewerDetectionType, SeniorityBand } from './types'
import { roleTenureMonths } from './role-tenure'
import { detectOverlappingRolePairs } from './overlap-detection'

export interface ReviewerDetection {
  detectionType: ReviewerDetectionType
  detectedContext: Record<string, unknown>
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30

function scopeMagnitude(role: ResumeAnalysisFacts['roles'][number]): number {
  if (role.budgetOrPnlUsd) return role.budgetOrPnlUsd
  if (role.quotaUsd) return role.quotaUsd * 3
  if (role.headcount) return role.headcount * 200_000
  return 0
}

export function detectReviewerQuestions(facts: ResumeAnalysisFacts, band: SeniorityBand): ReviewerDetection[] {
  const detections: ReviewerDetection[] = []
  const sorted = [...facts.roles]
    .filter((r) => r.startDate)
    .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime())

  // Gaps — look at consecutive real (non-internship) roles for a >=4-month hole.
  const real = sorted.filter((r) => !r.isInternship)
  for (let i = 1; i < real.length; i++) {
    const prevEnd = real[i - 1].endDate ? new Date(real[i - 1].endDate as string).getTime() : null
    const curStart = real[i].startDate ? new Date(real[i].startDate as string).getTime() : null
    if (prevEnd === null || curStart === null) continue
    const gapMonths = (curStart - prevEnd) / MS_PER_MONTH
    const withinLast5Years = (Date.now() - prevEnd) / MS_PER_MONTH < 60
    if (gapMonths >= 4 && withinLast5Years) {
      detections.push({
        detectionType: 'UNEXPLAINED_RECENT_GAP',
        detectedContext: { before: real[i - 1].title, after: real[i].title, gapMonths: Math.round(gapMonths) },
      })
    }
  }

  // Current gap — most recent real role has ended and nothing follows.
  const mostRecent = real[real.length - 1]
  if (mostRecent && !mostRecent.isCurrent && mostRecent.endDate) {
    detections.push({ detectionType: 'UNEXPLAINED_CURRENT_GAP', detectedContext: { lastRole: mostRecent.title } })
  }

  // Short tenure at most recent/current role.
  if (mostRecent) {
    const tenure = roleTenureMonths(mostRecent)
    if (tenure !== null && tenure < 18) {
      detections.push({ detectionType: 'SHORT_TENURE_RECENT', detectedContext: { role: mostRecent.title, company: mostRecent.company, months: Math.round(tenure) } })
    }
  }

  // Recent short-tenure cluster — >=2 stints under 18mo in the last 5 years.
  const recentShort = real.filter((r) => {
    const tenure = roleTenureMonths(r)
    const endTime = r.endDate ? new Date(r.endDate).getTime() : Date.now()
    return tenure !== null && tenure < 18 && (Date.now() - endTime) / MS_PER_MONTH < 60
  })
  if (recentShort.length >= 2) {
    detections.push({ detectionType: 'SHORT_TENURE_CLUSTER', detectedContext: { roles: recentShort.map((r) => r.title) } })
  }

  // Apparent scope decrease between consecutive roles.
  for (let i = 1; i < real.length; i++) {
    const prevScope = scopeMagnitude(real[i - 1])
    const curScope = scopeMagnitude(real[i])
    if (prevScope > 0 && curScope > 0 && curScope < prevScope * 0.7) {
      detections.push({ detectionType: 'SCOPE_DECREASE', detectedContext: { from: real[i - 1].title, to: real[i].title } })
    }
  }

  // Thin recent entry — most recent role has materially fewer bullets, no numbers.
  if (mostRecent && mostRecent.bullets.length <= 2 && mostRecent.bullets.every((b) => !b.hasAnyNumber)) {
    detections.push({ detectionType: 'THIN_RECENT_ENTRY', detectedContext: { role: mostRecent.title, company: mostRecent.company } })
  }

  // Extended tenure without title change (>6 years in one title).
  for (const role of real) {
    const tenure = roleTenureMonths(role)
    if (tenure !== null && tenure > 72) {
      detections.push({ detectionType: 'EXTENDED_TENURE_NO_CHANGE', detectedContext: { role: role.title, years: Math.round(tenure / 12) } })
    }
  }

  // Title inflation — stated title outranks stated scope by a wide margin.
  // Only fires for Senior/Executive-titled roles with genuinely small
  // stated scope, so early-career titles (which rarely carry scope numbers
  // at all) don't false-positive.
  const seniorTitlePattern = /\b(vp|vice president|director|chief|president|evp|svp)\b/i
  for (const role of real) {
    if (seniorTitlePattern.test(role.title) && scopeMagnitude(role) > 0 && scopeMagnitude(role) < 500_000) {
      detections.push({ detectionType: 'TITLE_INFLATION', detectedContext: { role: role.title, company: role.company } })
    }
  }

  // Overlapping roles — same detector modifiers.ts's computeReconciliation
  // uses for the Market Reality Grade's overlapping_full_time penalty, so
  // this and that never disagree on which overlaps actually count (a board
  // seat/advisor/non-employee-director role concurrent with a primary job
  // is excluded — see overlap-detection.ts).
  for (const pair of detectOverlappingRolePairs(facts.roles)) {
    detections.push({ detectionType: 'OVERLAPPING_ROLES', detectedContext: { a: pair.earlier.title, b: pair.later.title } })
  }

  // Credential without granting institution.
  for (const edu of facts.education) {
    if (!edu.hasGrantingInstitution) {
      detections.push({ detectionType: 'CREDENTIAL_NO_INSTITUTION', detectedContext: { degree: edu.degree } })
    }
  }

  // Portfolio-career read — >=3 concurrent board/advisory roles.
  const concurrentBoardSeats = facts.extracurricular.filter((e) => e.kind === 'BOARD_SEAT' && e.isCurrent)
  if (concurrentBoardSeats.length >= 3) {
    detections.push({ detectionType: 'PORTFOLIO_CAREER', detectedContext: { count: concurrentBoardSeats.length } })
  }

  // Comp-fit / flight-risk read — Executive band targeting notably below prior scope.
  // Left to the composite-assembly layer (Phase 4), which has the target
  // comp/level context this module deliberately doesn't take as input —
  // computed here only when band is EXECUTIVE and the resume's own recent
  // scope is large relative to typical mid-market bands, as a light signal.
  if (band === 'EXECUTIVE' && mostRecent && scopeMagnitude(mostRecent) > 200_000_000) {
    detections.push({ detectionType: 'COMP_FIT_RISK', detectedContext: { role: mostRecent.title } })
  }

  return detections
}
