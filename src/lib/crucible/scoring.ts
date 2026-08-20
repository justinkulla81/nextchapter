// Deterministic, pure scoring engine — every score is a pure function of
// the stored submission (flags, verdict, worst-thing text, AI-tools
// disclosure) plus the variant's versioned answer key. Same submission, same
// score, every run, forever. No LLM call anywhere in this path — the teaser
// uses none of the model-assisted classification the full product will.
import { CRUCIBLE_ANSWER_KEYS, CRUCIBLE_BAND_LABEL, type CrucibleVariantKey } from './variants'
import type {
  CrucibleFlag,
  CrucibleScoreBreakdown,
  CrucibleScoreResult,
  CrucibleSubmission,
} from './scoring-types'

// Config is versioned data, not code constants sprinkled through the scoring
// logic — bump SCORING_VERSION whenever weights/thresholds/answer keys
// change, so every historical score stays recomputable and auditable
// against the exact rules that produced it (see spec §11).
export const SCORING_VERSION = 'v1'
export const CONTENT_VERSION = 'v1'

const POINTS = {
  defectExact: 60,
  defectNearMiss: 45,
  verdictCorrect: 25,
  herringCalibrated: 5,
  herringOverblocked: -10,
  driverBonus: 10,
} as const

const SEVERITY_RANK = { cosmetic: 0, minor: 1, critical: 2 } as const

function matchesKeywordClass(note: string, keywords: string[]): boolean {
  const lower = note.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

function findFlagOnLine(flags: CrucibleFlag[], line: number): CrucibleFlag | undefined {
  return flags.find((f) => f.line === line)
}

function scoreDefectDetection(
  flags: CrucibleFlag[],
  key: CrucibleVariantKey
): { detection: CrucibleScoreBreakdown['defectDetection']; points: number } {
  const answerKey = CRUCIBLE_ANSWER_KEYS[key]
  // Any flag inside the defect zone at severity >= minor is a candidate —
  // the defect is a missing line (nothing to click exactly), so any nearby
  // flag in the zone counts, not just one specific line number.
  const candidate = flags.find(
    (f) => answerKey.defectZoneLines.includes(f.line) && SEVERITY_RANK[f.severity] >= SEVERITY_RANK.minor
  )
  if (!candidate) return { detection: 'none', points: 0 }

  if (candidate.mechanism === answerKey.defectMechanism) {
    return { detection: 'exact', points: POINTS.defectExact }
  }
  // Near-miss: right zone, wrong mechanism pick, but the free-text note
  // independently demonstrates real understanding — supplementary credit,
  // never the primary scoring path.
  if (matchesKeywordClass(candidate.note, answerKey.defectKeywords)) {
    return { detection: 'near_miss', points: POINTS.defectNearMiss }
  }
  return { detection: 'none', points: 0 }
}

function scoreVerdict(submission: CrucibleSubmission, defectDetection: string): number {
  if (submission.verdict === 'BLOCK') return POINTS.verdictCorrect
  if (submission.verdict === 'SHIP_WITH_CONDITIONS' && defectDetection !== 'none') return POINTS.verdictCorrect
  return 0
}

function scoreHerring(
  flags: CrucibleFlag[],
  key: CrucibleVariantKey,
  submission: CrucibleSubmission
): { outcome: CrucibleScoreBreakdown['herringOutcome']; points: number } {
  const answerKey = CRUCIBLE_ANSWER_KEYS[key]
  const flag = findFlagOnLine(flags, answerKey.herringLine)

  // Cited as the actual block reason, even without a formal flag on the
  // line — the worst-thing text naming the herring as the top issue is the
  // same calibration failure as flagging it critical.
  const citedAsBlockReason = submission.worstThing.toLowerCase().includes('console.log')

  if (!flag) {
    return citedAsBlockReason ? { outcome: 'overblocked', points: POINTS.herringOverblocked } : { outcome: 'ignored', points: 0 }
  }
  if (flag.severity === 'critical' || citedAsBlockReason) {
    return { outcome: 'overblocked', points: POINTS.herringOverblocked }
  }
  if (flag.severity === 'minor' || flag.severity === 'cosmetic') {
    return { outcome: 'calibrated', points: POINTS.herringCalibrated }
  }
  return { outcome: 'ignored', points: 0 }
}

function scoreDriverBonus(submission: CrucibleSubmission): { earned: boolean; points: number } {
  const earned = !!submission.aiTools && submission.aiTools.tools.length > 0 && submission.aiTools.bestMove.trim().length > 0
  return { earned, points: earned ? POINTS.driverBonus : 0 }
}

export function scoreCrucibleSubmission(variant: CrucibleVariantKey, submission: CrucibleSubmission): CrucibleScoreResult {
  const { detection, points: defectPoints } = scoreDefectDetection(submission.flags, variant)
  const verdictPoints = scoreVerdict(submission, detection)
  const { outcome: herringOutcome, points: herringPoints } = scoreHerring(submission.flags, variant, submission)
  const { earned: driverBonusEarned, points: driverBonusPoints } = scoreDriverBonus(submission)

  const score = Math.max(0, defectPoints + verdictPoints + herringPoints + driverBonusPoints)
  const band = CRUCIBLE_BAND_LABEL(score)
  const branch = score >= 75 ? 'PASS' : 'GROWTH'

  const breakdown: CrucibleScoreBreakdown = {
    defectDetection: detection,
    defectPoints,
    verdictPoints,
    herringOutcome,
    herringPoints,
    driverBonusEarned,
    driverBonusPoints,
  }

  return { score, band, branch, breakdown, scoringVersion: SCORING_VERSION, contentVersion: CONTENT_VERSION }
}
