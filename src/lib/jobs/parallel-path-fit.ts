import { classifyWorkType, type JobWorkType, type WorkTypeInput } from '@/lib/jobs/work-type'

// What a member is doing alongside the search (ParallelPath.paths, set on the Past jobs
// page) shapes the board in two small ways, both pure and unit-tested
// (src/test/parallel-path-fit.test.ts):
//
//   VISIBILITY  contract and part-time roles are shown by default, the same as for a
//               member open to interim work (pathWorkTypes / defaultWorkTypes in
//               work-type.ts).
//   RANKING     a role that matches one of their paths moves up one competition level
//               within its fit level — it never jumps a fit level, so a stretch role
//               that happens to be contract work doesn't outrank a strong full-time fit.
//
// "School or training" is deliberately not used here: it says what the member is busy
// with, not what work they want. It is kept for their coach.

// Contract-to-hire is almost always W-2, so it is not "1099 work".
const W2_MARKER = /\b(w-?2|contract[- ]to[- ]hire|c2h)\b/i
const INTERIM_OR_FRACTIONAL = /\b(interim|fractional)\b/i
const CONSULTING_TITLE = /\b(consult\w*|freelance)\b/i

type PostingLike = WorkTypeInput

function matchesPath(path: string, posting: PostingLike, workType: JobWorkType): boolean {
  switch (path) {
    case 'CONTRACT_1099':
      return workType === 'contract' && !W2_MARKER.test(`${posting.title}\n${(posting.description ?? '').slice(0, 3000)}`)
    case 'FRACTIONAL':
      return workType === 'part_time' || (workType === 'contract' && INTERIM_OR_FRACTIONAL.test(posting.title))
    case 'CONSULTING':
      return workType === 'contract' || CONSULTING_TITLE.test(posting.title)
    case 'OWN_BUSINESS':
      return workType === 'contract' || workType === 'part_time'
    case 'PART_TIME':
      return workType === 'part_time'
    default:
      return false
  }
}

/** True when the posting is the kind of work one of the member's parallel paths describes. */
export function matchesParallelPath(posting: PostingLike, paths: readonly string[] | null | undefined): boolean {
  if (!paths || paths.length === 0) return false
  const workType = classifyWorkType(posting)
  return paths.some((p) => matchesPath(p, posting, workType))
}

/**
 * The board's sort key: fit level × 3 + competition level (low 0, medium 1, high 2),
 * lower first. A path match lifts the competition part by one level but never below
 * the floor of its own fit level, so it only reorders within that level.
 */
export function boardRank(fitRank: number, competitionRank: number, pathMatch: boolean): number {
  return fitRank * 3 + Math.max(0, competitionRank - (pathMatch ? 1 : 0))
}
