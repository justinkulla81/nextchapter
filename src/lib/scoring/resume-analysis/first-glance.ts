// First Glance — spec §2.2/§3.5. An internal diagnostic only; never
// rendered as a second headline. Simulates the 6-30-second recruiter scan
// with deliberately different weights from the careful-read Record
// composite, so the two can diverge (a resume can read excellently on
// careful read and still bury its lede).

import type { ResumeAnalysisFacts } from './extract-facts'
import type { FirstGlanceResult } from './types'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export interface FirstGlanceComputation {
  score: number
  result: FirstGlanceResult
  topFix: string
}

export function computeFirstGlance(facts: ResumeAnalysisFacts, prestigeBonus: number): FirstGlanceComputation {
  // Spec §3.5 weights.
  const topOfDocument = facts.topOfDocumentClear ? 25 : 5
  const mostRecentRole = facts.mostRecentRoleLegibleAtGlance ? 20 : 5
  const trajectory = facts.trajectoryApparentAtGlance ? 15 : 5
  const scanability = (facts.visualScanability / 100) * 15
  const hasHardAtsFailure = facts.atsFlags.some((f) => f.isHardFailure)
  const gapOrClusterVisible = facts.roles.length > 0 && !facts.mostRecentRoleLegibleAtGlance
  const gapPenaltyAvoided = gapOrClusterVisible ? 0 : 15 // penalty-driven signal, spec table — full credit when nothing visible on page one

  const rawScore = topOfDocument + mostRecentRole + trajectory + scanability + gapPenaltyAvoided + prestigeBonus
  const score = clamp(rawScore)

  let result: FirstGlanceResult = 'PASS'
  if (score < 50 || hasHardAtsFailure) result = 'LIKELY_SKIP'
  else if (score < 75) result = 'BORDERLINE'

  let topFix = 'Your top-of-document clarity is your biggest lever here.'
  if (!facts.topOfDocumentClear) {
    topFix = 'Your name, current title, and target aren\'t all visible in the first glance — fix that first.'
  } else if (!facts.mostRecentRoleLegibleAtGlance) {
    topFix = 'Your most recent role\'s title, company, dates, and scope should all be visible without reading closely.'
  } else if (facts.visualScanability < 50) {
    topFix = 'The page reads as dense — more whitespace and clearer hierarchy would help a fast scan.'
  }

  return { score, result, topFix }
}
