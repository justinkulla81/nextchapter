// QA-judgment scoring is pure and deterministic — same submission, same
// score, every run, forever, no LLM call anywhere in this file. The two
// AI-graded activities (prompt-authoring, dataset-analysis) are scored
// separately in ai-grading.ts (a real LLM call, not a pure function) and
// their resulting numeric scores are combined here in
// combineCrucibleScores — combination stays pure even though one upstream
// input isn't, so "same inputs → same final score" still holds at this
// layer.
import { CRUCIBLE_BAND_LABEL, getQaContent, type CrucibleVariantKey } from './variants'
import type {
  CrucibleAiTools,
  CrucibleQaSubmission,
  CrucibleScoreBreakdown,
  CrucibleScoreResult,
  CrucibleTierKey,
  CrucibleTiersReached,
} from './scoring-types'

// Config is versioned data, not code constants sprinkled through the scoring
// logic — bump SCORING_VERSION whenever weights/thresholds/answer keys
// change, so every historical score stays recomputable and auditable
// against the exact rules that produced it (see spec §11). v4: added a
// fourth activity, Read the Results — re-split the 60% previously shared
// between prompt/dataset three ways instead of two. v5 (content only,
// scoring logic unchanged): every job-intent function now gets genuinely
// distinct QA content at every tier — DESIGN and BUSINESS variants added,
// DATA relabeled "Operations & Data Analysts," and the EASY/HARD tiers
// (previously one shared CODE-flavored scenario for every discipline) are
// now real per-variant content too.
export const SCORING_VERSION = 'v4'
export const CONTENT_VERSION = 'v5'

const POINTS = {
  defectExact: 60,
  verdictCorrect: 25,
  herringCalibrated: 5,
  herringOverblocked: -10,
  driverBonus: 10,
} as const

// A tier attempt "clears" when the candidate both caught the real issue AND
// acted correctly on it — either is easy to get half-right (catch it but
// still ship, or block without naming why), so both are required to unlock
// the next tier. Same bar regardless of which tier this is — EASY isn't
// graded on a curve, it's just a scenario with a shallower defect.
export function qaTierPassed(qa: CrucibleQaScoreResult): boolean {
  return qa.defectDetection === 'exact' && qa.verdictPoints > 0
}

// AI-graded activities clear a tier at 70+ — "good," not "perfect." Matches
// the grading rubric's own language (gradeSubmission's prompt in
// ai-grading.ts asks for a genuinely discerning score, not automatic high
// marks), so 70 is a real bar, not a rubber stamp.
export const AI_GRADE_PASS_THRESHOLD = 70
export function aiGradeTierPassed(score: number): boolean {
  return score >= AI_GRADE_PASS_THRESHOLD
}

// Best-case raw QA points (defect + verdict + herring-calibrated), used to
// normalize the QA activity onto the same 0-100 scale as the two AI-graded
// activities before weighting.
const QA_MAX_RAW = POINTS.defectExact + POINTS.verdictCorrect + POINTS.herringCalibrated

// QA carries the most weight — it's the only activity with a deterministic,
// unambiguous right answer. The three AI-graded activities split the
// remaining 60% evenly since AI grading has some inherent noise regardless
// of which one it is.
const WEIGHTS = { qa: 0.4, prompt: 0.2, dataset: 0.2, results: 0.2 } as const

export interface CrucibleQaScoreResult {
  defectDetection: CrucibleScoreBreakdown['defectDetection']
  defectPoints: number
  verdictPoints: number
  herringOutcome: CrucibleScoreBreakdown['herringOutcome']
  herringPoints: number
  rawPoints: number
}

function scoreDefectDetection(
  variant: CrucibleVariantKey,
  tier: CrucibleTierKey,
  selectedOptionIds: string[]
): { detection: CrucibleScoreBreakdown['defectDetection']; points: number } {
  const defectOption = getQaContent(variant, tier).checklistOptions.find((o) => o.isDefect)
  if (defectOption && selectedOptionIds.includes(defectOption.id)) {
    return { detection: 'exact', points: POINTS.defectExact }
  }
  return { detection: 'none', points: 0 }
}

function scoreVerdict(verdict: CrucibleQaSubmission['verdict'], defectDetection: string): number {
  if (verdict === 'BLOCK') return POINTS.verdictCorrect
  if (verdict === 'SHIP_WITH_CONDITIONS' && defectDetection !== 'none') return POINTS.verdictCorrect
  return 0
}

function scoreHerring(
  variant: CrucibleVariantKey,
  tier: CrucibleTierKey,
  selectedOptionIds: string[],
  verdict: CrucibleQaSubmission['verdict']
): { outcome: CrucibleScoreBreakdown['herringOutcome']; points: number } {
  const herringOption = getQaContent(variant, tier).checklistOptions.find((o) => o.isHerring)
  const selected = !!herringOption && selectedOptionIds.includes(herringOption.id)

  if (!selected) return { outcome: 'calibrated', points: POINTS.herringCalibrated }
  // Selecting the herring is fine on its own — it's a real (if minor) issue.
  // Letting it drive an actual BLOCK is the calibration failure being
  // measured: the same distraction that costs nothing to notice costs real
  // money to act on.
  if (verdict === 'BLOCK') return { outcome: 'overblocked', points: POINTS.herringOverblocked }
  return { outcome: 'ignored', points: 0 }
}

export function scoreQaSubmission(
  variant: CrucibleVariantKey,
  tier: CrucibleTierKey,
  submission: CrucibleQaSubmission
): CrucibleQaScoreResult {
  const { detection, points: defectPoints } = scoreDefectDetection(variant, tier, submission.selectedOptionIds)
  const verdictPoints = scoreVerdict(submission.verdict, detection)
  const { outcome: herringOutcome, points: herringPoints } = scoreHerring(variant, tier, submission.selectedOptionIds, submission.verdict)

  return {
    defectDetection: detection,
    defectPoints,
    verdictPoints,
    herringOutcome,
    herringPoints,
    rawPoints: defectPoints + verdictPoints + herringPoints,
  }
}

function scoreDriverBonus(aiTools: CrucibleAiTools | null): { earned: boolean; points: number } {
  const earned = !!aiTools && aiTools.tools.length > 0 && aiTools.bestMove.trim().length > 0
  return { earned, points: earned ? POINTS.driverBonus : 0 }
}

// Called once all four activities (QA, prompt, dataset, results) plus the
// AI-tools disclosure are in — promptScore/datasetScore/resultsScore are
// the AI grader's 0-100 outputs (see ai-grading.ts), already resolved by
// the time this runs.
export function combineCrucibleScores(
  qa: CrucibleQaScoreResult,
  promptScore: number,
  datasetScore: number,
  resultsScore: number,
  aiTools: CrucibleAiTools | null,
  tiersReached: CrucibleTiersReached
): CrucibleScoreResult {
  const qaPercent = Math.max(0, Math.min(100, (qa.rawPoints / QA_MAX_RAW) * 100))
  const { earned: driverBonusEarned, points: driverBonusPoints } = scoreDriverBonus(aiTools)

  const weighted =
    qaPercent * WEIGHTS.qa + promptScore * WEIGHTS.prompt + datasetScore * WEIGHTS.dataset + resultsScore * WEIGHTS.results
  const score = Math.max(0, Math.min(100, Math.round(weighted + driverBonusPoints)))
  const band = CRUCIBLE_BAND_LABEL(score)
  const branch = score >= 75 ? 'PASS' : 'GROWTH'

  const breakdown: CrucibleScoreBreakdown = {
    defectDetection: qa.defectDetection,
    defectPoints: qa.defectPoints,
    verdictPoints: qa.verdictPoints,
    herringOutcome: qa.herringOutcome,
    herringPoints: qa.herringPoints,
    driverBonusEarned,
    driverBonusPoints,
    promptPoints: Math.round(promptScore * WEIGHTS.prompt),
    datasetPoints: Math.round(datasetScore * WEIGHTS.dataset),
    resultsPoints: Math.round(resultsScore * WEIGHTS.results),
  }

  return { score, band, branch, breakdown, tiersReached, scoringVersion: SCORING_VERSION, contentVersion: CONTENT_VERSION }
}
