// The board narrowed to one pivot target ("Show me these jobs" on a pivot path):
// which titles to keep, and how to rank them. Pure, client-safe.

import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { ROLES, titleMatchesRole } from './pivot-map'

export interface PivotBoardFilter {
  target: string
  label: string
  matchesTitle: (title: string) => boolean
  /**
   * Fields laid over the member's profile while the filter is on: ranked as if
   * already in the target function (the board's own reading of the target's
   * titles as a second function, when it differs), and pivoting, so mid-level
   * jobs show.
   */
  candidateOverride: { primaryFunction: string | null; secondaryFunction: string | null; isPivoting: true }
}

export function pivotBoardFilter(param: string | string[] | undefined | null): PivotBoardFilter | null {
  const key = Array.isArray(param) ? param[0] : param
  if (!key) return null
  const role = ROLES.get(key)
  if (!role) return null
  const boardFn = inferFunctionFromTitle(role.examples[0])
  const primary = role.fn ?? boardFn
  return {
    target: role.key,
    label: role.label,
    matchesTitle: (title) => titleMatchesRole(role.key, title),
    candidateOverride: { primaryFunction: primary, secondaryFunction: boardFn && boardFn !== primary ? boardFn : null, isPivoting: true },
  }
}
