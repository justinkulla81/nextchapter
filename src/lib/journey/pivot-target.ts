// One source of truth for "is this member moving to another function, and to which one".
//
// Before: CandidateProfile.isPivoting (a flag set by the Changing careers journey and Search Strategy) and
// CandidateProfile.targetFunction (the function they want to move to) were written in different places and
// could disagree. Now targetFunction is the truth. isPivoting stays in the table, written together with it
// so older readers keep working, but nothing new should read it directly: use these helpers.
//
// Pure and client-safe.

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

interface TargetFields {
  targetFunction?: string | null
  primaryFunction?: string | null
}

/**
 * The function the member wants to move to, or null. A target equal to the function they already work in is
 * not a move, so it does not count.
 */
export function pivotTargetOf(p: TargetFields): string | null {
  const target = p.targetFunction?.trim()
  if (!target) return null
  return norm(target) === norm(p.primaryFunction) ? null : target
}

/**
 * Whether the member is moving to another function. True when they have a target different from their own
 * function, or when their journey is Changing careers (they have said so, even before naming a target).
 */
export function isPivotingProfile(p: TargetFields & { journey?: string | null }): boolean {
  return pivotTargetOf(p) !== null || p.journey === 'CAREER_CHANGE'
}

/** What to store when a target is set or cleared, so the target and the older flag are always written together. */
export function pivotTargetWrite(fn: string | null, opts: { keepFlag?: boolean } = {}): { targetFunction: string | null; isPivoting?: boolean } {
  const target = fn?.trim() || null
  // Clearing a target does not clear the flag when the member is on the Changing careers journey (keepFlag).
  return target ? { targetFunction: target, isPivoting: true } : { targetFunction: null, ...(opts.keepFlag ? {} : { isPivoting: false }) }
}

/** Where the stored flag and the target disagree. Used by the repair SQL and by tests. */
export function pivotFlagDrift(p: TargetFields & { journey?: string | null; isPivoting: boolean }): 'none' | 'flag_without_target' | 'target_without_flag' {
  const expected = isPivotingProfile(p)
  if (expected === p.isPivoting) return 'none'
  return p.isPivoting ? 'flag_without_target' : 'target_without_flag'
}
