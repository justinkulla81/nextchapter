// Where a visitor came from when they started onboarding from a place page (/places/...) or a workforce board's page, and the
// situation they picked there ("I was laid off", "I just graduated", "I'm moving here", "I live here and want a new job").
// Pure and client-safe: the public pages build the link, the first onboarding screen reads it back, and it is kept in
// journeyDetails.arrivedFrom so the Where step can offer the board and fill in the move.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { SITUATION_TO_JOURNEY, type SituationKey } from '@/lib/constants/onboarding'

export const ARRIVED_FROM_KEY = 'arrivedFrom'

/** The four answers a place or board page offers, in the order shown. */
export const PLACE_SITUATIONS = [
  { situation: 'just_laid_off', label: 'I was laid off' },
  { situation: 'just_graduated', label: 'I just graduated' },
  { situation: 'relocating', label: 'I’m moving here' },
  { situation: 'ready_to_move', label: 'I live here and want a new job' },
] as const satisfies readonly { situation: SituationKey; label: string }[]

export interface ArrivedFrom {
  /** Two-letter state code. */
  state: string
  /** The place as the page names it ("Franklin County", "Columbus"). */
  area: string | null
  /** The workforce board serving the place, when there is exactly one. */
  boardId: string | null
  situation: SituationKey | null
}

/** The query names on the onboarding link. Short, so the link stays readable. */
const P = { state: 'st', area: 'area', board: 'board', situation: 'situation' } as const

const STATE = /^[A-Z]{2}$/
// CareerOneStop board ids are short alphanumerics; anything else is not a board.
const BOARD = /^[A-Za-z0-9_-]{1,40}$/

/** The onboarding link for one choice on a place or board page. `from` keeps the existing `from=top_<slug>` attribution. */
export function placeStartHref(input: { situation?: SituationKey | null; state: string; area?: string | null; boardId?: string | null; from: string }): string {
  const q = new URLSearchParams()
  q.set('from', input.from)
  if (input.situation) q.set(P.situation, input.situation)
  q.set(P.state, input.state.toUpperCase())
  if (input.area) q.set(P.area, input.area.slice(0, 80))
  if (input.boardId) q.set(P.board, input.boardId)
  return `${MARKET_REALITY_START_HREF}&${q.toString()}`
}

/** What the link carried, made safe. Null when there is no valid state (the link did not come from a place or board page). */
export function parseArrivedFrom(params: Record<string, string | string[] | undefined>): ArrivedFrom | null {
  const one = (k: string) => {
    const v = params[k]
    return typeof v === 'string' ? v.trim() : ''
  }
  const state = one(P.state).toUpperCase()
  if (!STATE.test(state)) return null
  const area = one(P.area).replace(/[^\p{L}\p{N} .,'’()-]/gu, '').slice(0, 80) || null
  const board = one(P.board)
  const situation = one(P.situation)
  return {
    state,
    area,
    boardId: BOARD.test(board) ? board : null,
    situation: situation in SITUATION_TO_JOURNEY ? (situation as SituationKey) : null,
  }
}

/** The hidden fields the first onboarding screen posts, and the reverse. */
export const ARRIVED_FIELDS = { state: 'arrivedState', area: 'arrivedArea', board: 'arrivedBoard', situation: 'arrivedSituation' } as const

export function arrivedHiddenFields(a: ArrivedFrom): Record<string, string> {
  return {
    [ARRIVED_FIELDS.state]: a.state,
    ...(a.area ? { [ARRIVED_FIELDS.area]: a.area } : {}),
    ...(a.boardId ? { [ARRIVED_FIELDS.board]: a.boardId } : {}),
    ...(a.situation ? { [ARRIVED_FIELDS.situation]: a.situation } : {}),
  }
}

export function arrivedFromForm(formData: FormData): ArrivedFrom | null {
  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : undefined
  }
  return parseArrivedFrom({ st: get(ARRIVED_FIELDS.state), area: get(ARRIVED_FIELDS.area), board: get(ARRIVED_FIELDS.board), situation: get(ARRIVED_FIELDS.situation) })
}

/** What was saved on the profile, read back. */
export function arrivedFromDetails(journeyDetails: unknown): ArrivedFrom | null {
  const v = (journeyDetails as Record<string, unknown> | null)?.[ARRIVED_FROM_KEY] as Partial<ArrivedFrom> | undefined
  if (!v || typeof v !== 'object') return null
  return parseArrivedFrom({ st: v.state ?? undefined, area: v.area ?? undefined, board: v.boardId ?? undefined, situation: v.situation ?? undefined })
}

/** The one workforce board to offer for a place: the only local board, or the only board at all. Several local boards: none. */
export function boardForPlace<T extends { id: string; statewide?: boolean | null }>(boards: T[]): T | null {
  const local = boards.filter((b) => !b.statewide)
  if (local.length === 1) return local[0]
  if (local.length === 0 && boards.length === 1) return boards[0]
  return null
}
