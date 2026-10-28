// What the résumé step should show for a stored parse state. Pure, so the stale-run rule is testable.

export type ResumeParseStatus = 'processing' | 'failed' | 'rejected'

export interface ResumeParseState {
  /** Unique per attempt (upload or retry); every write is guarded on it. */
  attempt: string
  status: ResumeParseStatus
  startedAt: string
  path: string
  fileName: string
  fileType: 'pdf' | 'docx'
  includeInResumeBook: boolean
  /** Set once the Resume row exists, so a retry reads the same row instead of making a second. */
  resumeId?: string
  /** For `rejected`: the plain sentence to show the member. */
  reason?: string
}

/** A run that has been going longer than this has died (the function was cut off); the member may retry. */
export const PARSE_STALE_MS = 4 * 60 * 1000

export type ResumeParseView =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'failed'; fileName: string; stalled: boolean }
  | { kind: 'rejected'; fileName: string; reason: string }

export function parseView(state: ResumeParseState | null, now: number = Date.now()): ResumeParseView {
  if (!state) return { kind: 'idle' }
  if (state.status === 'rejected') return { kind: 'rejected', fileName: state.fileName, reason: state.reason ?? "That doesn't look like a resume." }
  const stalled = now - new Date(state.startedAt).getTime() > PARSE_STALE_MS
  if (state.status === 'processing') return stalled ? { kind: 'failed', fileName: state.fileName, stalled: true } : { kind: 'processing', fileName: state.fileName }
  return { kind: 'failed', fileName: state.fileName, stalled: false }
}
