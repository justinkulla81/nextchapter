import { describe, expect, it } from 'vitest'
import { parseView, PARSE_STALE_MS, type ResumeParseState } from './parse-view'

const base: ResumeParseState = {
  attempt: 'a1',
  status: 'processing',
  startedAt: '2026-10-28T12:00:00.000Z',
  path: 'p/x.pdf',
  fileName: 'cv.pdf',
  fileType: 'pdf',
  includeInResumeBook: true,
}
const t0 = new Date(base.startedAt).getTime()

describe('parseView', () => {
  it('is idle with no state', () => {
    expect(parseView(null)).toEqual({ kind: 'idle' })
  })
  it('is processing while the run is fresh', () => {
    expect(parseView(base, t0 + 30_000)).toEqual({ kind: 'processing', fileName: 'cv.pdf' })
  })
  it('treats a run past the limit as failed and stalled, so the member can retry', () => {
    expect(parseView(base, t0 + PARSE_STALE_MS + 1)).toEqual({ kind: 'failed', fileName: 'cv.pdf', stalled: true })
  })
  it('shows a failed run as failed, not stalled', () => {
    expect(parseView({ ...base, status: 'failed' }, t0 + 5_000)).toEqual({ kind: 'failed', fileName: 'cv.pdf', stalled: false })
  })
  it('carries the reason of a rejected file', () => {
    expect(parseView({ ...base, status: 'rejected', reason: 'This looks like a cover letter.' })).toEqual({
      kind: 'rejected',
      fileName: 'cv.pdf',
      reason: 'This looks like a cover letter.',
    })
  })
})
