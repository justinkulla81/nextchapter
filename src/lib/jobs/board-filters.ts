// The board's function, employer-sector and hard-requirement filters as in-memory
// predicates over light rows (board-light-rows.ts LIGHT_SELECT carries
// targetFunction, employerSector and requirementTags), so they run on the shared
// cached board like the great-pay filter — no extra database read. Pure.

import { functionKeep } from '@/lib/jobs/job-functions'
import { EMPLOYER_SECTORS, type EmployerSector } from '@/lib/jobs/employer-sector'
import { flagsFromTags, hasHardBlocker, isClearedJobFor, requirementMemberOf, type RequirementProfile } from '@/lib/jobs/requirements'

export interface BoardRequirementFilters {
  /** Function filter key (job-functions.ts), or null for every function. */
  functionKey: string | null
  /** Sectors shown (all four by default). */
  sectorsShown: EmployerSector[]
  /** "Hide jobs I can't take": jobs with a hard blocker against the member's answers. Off by default. */
  hideBlockers: boolean
  /** "Cleared jobs": only jobs asking for a clearance the member's own clearance meets. */
  clearedOnly: boolean
}

type Row = { targetFunction: string | null; requirementTags: string | null }

/** The predicates the filters that are on add (empty when none are). */
export function requirementKeeps(f: BoardRequirementFilters, profile: RequirementProfile): ((p: Row) => boolean)[] {
  const member = requirementMemberOf(profile)
  const out: ((p: Row) => boolean)[] = []
  if (f.functionKey) out.push(functionKeep(f.functionKey))
  // Relocation is left to the card: a light row has no state to tell "a move" from
  // "already local", and the board must never hide a job the member could take.
  if (f.hideBlockers)
    out.push((p) => !p.requirementTags || !hasHardBlocker(flagsFromTags(p.requirementTags).filter((x) => x.flag !== 'relocation'), member))
  if (f.clearedOnly) out.push((p) => !!p.requirementTags && isClearedJobFor(flagsFromTags(p.requirementTags), member))
  return out
}

/** AND of the predicates given (nulls skipped); undefined when there are none. */
export function combineKeeps<T>(keeps: (((p: T) => boolean) | null | undefined)[]): ((p: T) => boolean) | undefined {
  const fs = keeps.filter((k): k is (p: T) => boolean => !!k)
  if (fs.length === 0) return undefined
  if (fs.length === 1) return fs[0]
  return (p) => fs.every((k) => k(p))
}

/** Partner-search jobs have no function / requirement data and read as private. */
export function surfacedPassesBoardFilters(f: BoardRequirementFilters): boolean {
  if (f.functionKey || f.clearedOnly) return false
  return f.sectorsShown.includes('private') || f.sectorsShown.length === EMPLOYER_SECTORS.length
}
