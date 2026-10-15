// The one wording for any multi-step form, so every staged flow reads the same:
// "Step 2 of 4: Resume. About 2 minutes left." Callers own their steps.

export interface StagedStep {
  label: string
  /** Rough minutes this step takes. */
  minutes: number
}

export function stagedSummary(steps: StagedStep[], index: number): string {
  const i = Math.min(Math.max(index, 0), steps.length - 1)
  const left = steps.slice(i).reduce((n, s) => n + s.minutes, 0)
  return `Step ${i + 1} of ${steps.length}: ${steps[i].label}. About ${left} minute${left === 1 ? '' : 's'} left.`
}
