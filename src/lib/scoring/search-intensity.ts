// Two independent signals feed "casual": jobSearchDifficultyLevel (only its
// bottom stop, "I'm taking my time", implies no active time pressure — the
// other three stops are gradients of active urgency) and searchIntensity
// (a direct "how actively are you searching" self-report — anything other
// than ACTIVELY_SEARCHING means the candidate isn't racing a clock, whether
// or not they've called their search "difficult").
const CASUAL_THRESHOLD = 1
const CASUAL_SEARCH_INTENSITIES = new Set(['CASUALLY_LOOKING', 'EXPLORING', 'OPEN'])

export function isCasuallySearching(
  jobSearchDifficultyLevel: number | null,
  searchIntensity?: string | null
): boolean {
  if (searchIntensity && CASUAL_SEARCH_INTENSITIES.has(searchIntensity)) return true
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
