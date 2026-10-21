import { createHash } from 'node:crypto'

/** One copied note counts once in this window, however many times "I sent it" is tapped. */
export const OUTREACH_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Where the copied note came from. */
export const OUTREACH_SOURCES = ['who_to_contact', 'outreach_template', 'outreach_coach'] as const
export type OutreachSource = (typeof OUTREACH_SOURCES)[number]

export function isOutreachSource(v: unknown): v is OutreachSource {
  return typeof v === 'string' && (OUTREACH_SOURCES as readonly string[]).includes(v)
}

/**
 * A stable key for "this note, for this job/contact/template": whitespace and case don't
 * make a different note. The note text itself is never stored, only this hash.
 */
export function outreachNoteKey(subjectKey: string, note: string): string {
  const normalized = note.replace(/\s+/g, ' ').trim().toLowerCase()
  return createHash('sha256').update(`${subjectKey}\n${normalized}`).digest('hex').slice(0, 32)
}

/** Whether a note logged at `lastLoggedAt` still blocks a new log at `now`. */
export function isDuplicateOutreach(lastLoggedAt: Date | null, now: Date): boolean {
  return !!lastLoggedAt && now.getTime() - lastLoggedAt.getTime() < OUTREACH_DEDUPE_WINDOW_MS
}
