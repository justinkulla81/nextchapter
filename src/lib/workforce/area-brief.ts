// The anonymous picture of NextChapter members in an area (a workforce board's
// service area or a state), for the board and for members who live there.
// Counts only. Never a name, never an employer a member works for, and no
// group smaller than BOARD_MIN_GROUP is ever shown, because a board is an
// outside party and a small count can point at one person. When one cell of a
// breakdown is hidden, the next smallest is hidden too, so the hidden number
// cannot be worked out from the total. Pure, so the rules can be tested.

import type { JourneyStage, JourneyType } from '@/lib/journey/journey'
import { JOURNEYS, STAGES } from '@/lib/journey/journey'

export const BOARD_MIN_GROUP = 10
export const LANDED_WINDOW_DAYS = 90

export type MemberRow = {
  journey: JourneyType | null
  stage: JourneyStage | null
  // When the member moved to Landed (stage change time), if they are Landed.
  landedAt: Date | null
}

export type Cell = { key: string; label: string; count: number | null } // null: fewer than the minimum

export type CandidateStatus = {
  // null when the whole group is too small to show anything about.
  total: number | null
  byJourney: Cell[]
  byStage: Cell[]
  landedRecently: number | null
  windowDays: number
}

export function hideSmall(cells: { key: string; label: string; count: number }[], total: number): Cell[] {
  const out: Cell[] = cells.map((c) => ({ ...c, count: c.count >= BOARD_MIN_GROUP ? c.count : null }))
  // One hidden cell next to a shown total would give itself away by subtraction:
  // hide the smallest shown cell as well.
  const hidden = out.filter((c) => c.count === null && cells.find((x) => x.key === c.key)!.count > 0)
  if (hidden.length === 1 && total >= BOARD_MIN_GROUP) {
    const smallestShown = out.filter((c) => c.count !== null).sort((a, b) => a.count! - b.count!)[0]
    if (smallestShown) smallestShown.count = null
  }
  return out.filter((c) => cells.find((x) => x.key === c.key)!.count > 0)
}

export function candidateStatus(rows: MemberRow[], now: Date = new Date()): CandidateStatus {
  const total = rows.length
  if (total < BOARD_MIN_GROUP) {
    return { total: null, byJourney: [], byStage: [], landedRecently: null, windowDays: LANDED_WINDOW_DAYS }
  }
  const journeyCells = JOURNEYS.map((j) => ({ key: j.key, label: j.label, count: rows.filter((r) => r.journey === j.key).length }))
  const stageCells = STAGES.map((s) => ({ key: s.key, label: s.label, count: rows.filter((r) => r.stage === s.key).length }))
  const since = now.getTime() - LANDED_WINDOW_DAYS * 86_400_000
  const landed = rows.filter((r) => r.stage === 'LANDED' && r.landedAt && r.landedAt.getTime() >= since).length
  return {
    total,
    byJourney: hideSmall(journeyCells, total),
    byStage: hideSmall(stageCells, total),
    landedRecently: landed >= BOARD_MIN_GROUP ? landed : null,
    windowDays: LANDED_WINDOW_DAYS,
  }
}

// How to say a hidden number.
export function showCount(n: number | null): string {
  return n === null ? `Fewer than ${BOARD_MIN_GROUP}` : n.toLocaleString('en-US')
}

// Two-letter state code from a code or a name ("NC", "North Carolina").
export function stateCode(raw: string | null | undefined, names: Record<string, string>): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (!t) return null
  if (names[t.toUpperCase()]) return t.toUpperCase()
  const hit = Object.entries(names).find(([, name]) => name.toLowerCase() === t.toLowerCase())
  return hit ? hit[0] : null
}
