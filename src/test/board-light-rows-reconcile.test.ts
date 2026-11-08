import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const queryRaw = vi.fn()
const findFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), cronRun: { findFirst: (...a: unknown[]) => findFirst(...a) } } }))
vi.mock('@/lib/db/statement-timeout', () => ({ withStatementTimeout: (q: Promise<unknown>) => q }))

import { loadReconcileResumePoint, reconcileBoardLightRows, resumePointFrom } from '@/lib/jobs/board-light-rows'

// The loop asks for where a page ends, then reconciles it. `ends` are the page ends in order (null = the last page); `writes` are the
// results of each page's repair, or an Error for a page that fails.
function script(ends: (string | null)[], writes: ({ upserted: number; deleted: number } | Error)[]) {
  let e = 0
  let w = 0
  queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const text = strings.join('?')
    if (text.includes('OFFSET')) {
      const end = ends[e++]
      if (end === undefined) throw new Error('paging failed')
      return end === null ? [] : [{ id: end }]
    }
    const r = writes[w++]
    if (r instanceof Error) throw r
    return [r]
  })
}

beforeEach(() => {
  queryRaw.mockReset()
  findFirst.mockReset()
})

describe('reconcileBoardLightRows', () => {
  it('adds up every page and reports a finished run', async () => {
    script(['b', 'c', null], [{ upserted: 0, deleted: 0 }, { upserted: 2, deleted: 1 }, { upserted: 0, deleted: 0 }])
    const r = await reconcileBoardLightRows({ pauseMs: 0 })
    expect(r).toMatchObject({ pages: 3, upserted: 2, deleted: 1, failedPages: 0, complete: true, nextId: null, skipped: [] })
  })

  it('skips a page whose write fails (lock timeout, deadlock) and carries on with the rest', async () => {
    script(['b', 'c', null], [{ upserted: 0, deleted: 0 }, new Error('canceling statement due to lock timeout'), { upserted: 1, deleted: 0 }])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await reconcileBoardLightRows({ pauseMs: 0 })
    expect(r).toMatchObject({ pages: 3, upserted: 1, failedPages: 1, complete: true, skipped: ['b'] })
  })

  it('stops, resumable, when the end of a page cannot be found', async () => {
    script(['b'], [{ upserted: 0, deleted: 0 }])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await reconcileBoardLightRows({ pauseMs: 0 })
    expect(r).toMatchObject({ pages: 1, failedPages: 1, complete: false, nextId: 'b' })
  })

  it('starts after the given id, which is how a retry resumes', async () => {
    script([null], [{ upserted: 0, deleted: 0 }])
    await reconcileBoardLightRows({ pauseMs: 0, startAfter: 'cmw123' })
    const firstCall = queryRaw.mock.calls[0]
    expect(firstCall.slice(1)).toContain('cmw123')
  })

  it('stops between pages at the time budget and says where it got to', async () => {
    script(['b', 'c', null], [{ upserted: 0, deleted: 0 }, { upserted: 0, deleted: 0 }, { upserted: 0, deleted: 0 }])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await reconcileBoardLightRows({ pauseMs: 0, budgetMs: -1 })
    expect(r).toMatchObject({ pages: 0, complete: false, nextId: '' })
  })

  it('leaves a progress note every four pages, and a failing note never stops the repair', async () => {
    script(['a', 'b', 'c', 'd', 'e', 'f', 'g', null], Array.from({ length: 8 }, () => ({ upserted: 0, deleted: 0 })))
    const notes: number[] = []
    const r = await reconcileBoardLightRows({
      pauseMs: 0,
      onProgress: (p) => {
        notes.push(p.pages)
        throw new Error('ledger down')
      },
    })
    expect(notes).toEqual([4])
    expect(r.complete).toBe(true)
  })
})

describe('resume point', () => {
  const now = new Date('2026-11-08T05:00:00Z')
  const run = (o: Partial<{ status: string; startedAt: Date; detail: string | null }> = {}) => ({
    status: 'TIMED_OUT',
    startedAt: new Date('2026-11-08T04:40:00Z'),
    detail: JSON.stringify({ step: 'reconcile', nextId: 'cmwabc', pages: 24 }),
    ...o,
  })

  it('resumes from the note a cut-off or failed run left', () => {
    expect(resumePointFrom(run(), now)).toBe('cmwabc')
    expect(resumePointFrom(run({ status: 'FAILED' }), now)).toBe('cmwabc')
  })

  it('does not resume a finished run, an old one, or one with no usable note', () => {
    expect(resumePointFrom(run({ status: 'OK' }), now)).toBeNull()
    expect(resumePointFrom(run({ startedAt: new Date('2026-11-08T04:40:00Z') }), new Date('2026-11-08T12:00:00Z'))).toBeNull()
    expect(resumePointFrom(run({ detail: null }), now)).toBeNull()
    expect(resumePointFrom(run({ detail: '{"step":"reconcile started"}' }), now)).toBeNull()
    expect(resumePointFrom(run({ detail: 'not json' }), now)).toBeNull()
    expect(resumePointFrom(null, now)).toBeNull()
  })

  it('reads the latest finished run of the job from the ledger', async () => {
    findFirst.mockResolvedValue(run({ startedAt: new Date() }))
    expect(await loadReconcileResumePoint(new Date())).toBe('cmwabc')
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ job: 'board-light-rows', status: { not: 'RUNNING' } })
  })
})
