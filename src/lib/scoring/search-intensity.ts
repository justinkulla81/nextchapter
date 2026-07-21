// Derived from jobSearchDifficultyLevel (the "How difficult has your job
// search been so far?" 1-4 slider on the Your Situation page) — this
// superseded the old jobSearchIntensity question (Batch 24), which asked
// desire/urgency directly. Only the bottom stop ("I'm taking my time")
// represents a candidate who isn't actively racing a clock — the other three
// stops are all gradients of active urgency.
const CASUAL_THRESHOLD = 1

export function isCasuallySearching(jobSearchDifficultyLevel: number | null): boolean {
  return jobSearchDifficultyLevel !== null && jobSearchDifficultyLevel <= CASUAL_THRESHOLD
}

// Converts the 1-4 jobSearchDifficultyLevel scale onto the same 0-100 axis
// the old jobSearchIntensity slider used (10/40/70/100 stops), so downstream
// scoring math that was tuned against that 0-100 range doesn't need to be
// re-derived — only the input source changes.
const DIFFICULTY_LEVEL_TO_INTENSITY_SCALE: Record<number, number> = { 1: 10, 2: 40, 3: 70, 4: 100 }

export function difficultyLevelToIntensityScore(jobSearchDifficultyLevel: number | null): number | null {
  if (jobSearchDifficultyLevel === null) return null
  return DIFFICULTY_LEVEL_TO_INTENSITY_SCALE[jobSearchDifficultyLevel] ?? null
}
