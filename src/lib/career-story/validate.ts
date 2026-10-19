// Checks for what a member adds or corrects on their story. Pure, so the rules are tested without
// a database. Nothing is cleared on a problem: the caller keeps what they typed.

import { STORY_KINDS, PAUSE_REASONS, type StoryKind, type PauseReason } from './events'

export const MEMBER_KINDS: StoryKind[] = ['VENTURE', 'PAUSE', 'SCHOOL', 'LEARNING', 'MILESTONE', 'WORK']
const POINT_KINDS: StoryKind[] = ['LEARNING', 'MILESTONE']

export type EventInput = { kind: string; label: string; detail: string; start: string; end: string; reason: string }
export type CleanEvent = { kind: StoryKind; label: string; detail: string | null; start: Date; end: Date | null; reason: PauseReason | null }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const toDate = (s: string): Date | null => {
  if (!DATE.test(s)) return null
  const d = new Date(`${s}T12:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

export function cleanEvent(input: EventInput, now = new Date()): { ok: true; value: CleanEvent } | { ok: false; error: string } {
  const kind = (STORY_KINDS as readonly string[]).includes(input.kind) && MEMBER_KINDS.includes(input.kind as StoryKind) ? (input.kind as StoryKind) : null
  if (!kind) return { ok: false, error: 'Choose what kind of chapter this is.' }
  const label = input.label.trim()
  if (!label) return { ok: false, error: 'Give it a short name, like “Caring for family” or “Side practice”.' }
  if (label.length > 80) return { ok: false, error: 'Keep the name to 80 characters or fewer.' }
  const detail = input.detail.trim()
  if (detail.length > 400) return { ok: false, error: 'Keep the note to 400 characters or fewer.' }
  const start = toDate(input.start)
  if (!start) return { ok: false, error: 'Pick a start date.' }
  const point = POINT_KINDS.includes(kind)
  let end: Date | null = null
  if (!point && input.end) {
    end = toDate(input.end)
    if (!end) return { ok: false, error: 'That end date does not look right. Pick it again or leave it empty if it is ongoing.' }
    if (end.getTime() < start.getTime()) return { ok: false, error: 'The end date comes before the start. Check the two dates.' }
  }
  const horizon = now.getTime() + 366 * 86_400_000
  if (start.getTime() > horizon) return { ok: false, error: 'A start date more than a year ahead cannot be part of your story yet. Try the doors below for plans.' }
  const reason = kind === 'PAUSE' && PAUSE_REASONS.some((r) => r.key === input.reason) ? (input.reason as PauseReason) : null
  return { ok: true, value: { kind, label, detail: detail || null, start, end, reason } }
}

export function cleanCushion(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = raw.trim()
  if (!t) return { ok: true, value: null }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > 60) return { ok: false, error: 'Enter a number of months between 0 and 60. A rough guess is fine.' }
  return { ok: true, value: Math.round(n * 2) / 2 }
}
