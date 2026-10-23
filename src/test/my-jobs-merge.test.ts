import { describe, expect, it } from 'vitest'
import { mergeMyJobItems, type MergeApplication, type MergeTracked } from '@/lib/jobs/my-jobs-merge'

const now = new Date('2026-10-23T12:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)

const app = (p: Partial<MergeApplication> & { id: string }): MergeApplication => ({
  source: 'BOARD', title: null, companyName: null, url: null, createdAt: ago(10),
  appliedAt: null, interviewLandedAt: null, offerReceivedAt: null, declinedAt: null, ...p,
})
const tracked = (p: Partial<MergeTracked> & { id: string; sourceId: string }): MergeTracked => ({
  source: 'job_board', title: 'Controller', companyName: 'Acme', url: 'https://acme.example/jobs/1', workType: 'full_time',
  savedAt: null, firstClickedAt: null, lastClickedAt: null, appliedVia: null, promptAnswer: null, promptAnsweredAt: null,
  dismissedAt: null, updatedAt: ago(1), jobPosting: null, ...p,
})

describe('mergeMyJobItems', () => {
  it('lists a board job linked to a Gmail application once, as the board job', () => {
    const gmail = app({ id: 'a1', source: 'EMAIL_DETECTED', companyName: 'Acme', appliedAt: ago(3) })
    const r = mergeMyJobItems({ tracked: [tracked({ id: 't1', sourceId: 'j1', jobPosting: gmail, appliedVia: 'email' })], surfaced: [], apps: [gmail], now })
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({ key: 'job_board:j1', status: 'applied', origin: 'email', jobPostingId: 'a1' })
  })

  it('merges board saves, partner jobs, Gmail and tracker applications, and jobs added by address', () => {
    const r = mergeMyJobItems({
      tracked: [
        tracked({ id: 't1', sourceId: 'j1', savedAt: ago(2) }),
        tracked({ id: 't2', source: 'external', sourceId: 'abc', title: 'Head of FP&A', savedAt: ago(1) }),
        tracked({ id: 't3', sourceId: 'j3' }), // opened only: a prompt, not a row
      ],
      surfaced: [{ id: 's1', title: 'CFO', companyName: 'Beta', url: null, description: null, reactedAt: ago(4), surfacedAt: ago(5) }],
      apps: [
        app({ id: 'a2', source: 'EMAIL_DETECTED', companyName: 'Gamma', appliedAt: ago(8), interviewLandedAt: ago(2) }),
        app({ id: 'a3', source: 'MANUAL', title: 'VP Finance', companyName: 'Delta', appliedAt: ago(6), declinedAt: ago(1) }),
      ],
      savedPostings: [app({ id: 'p1', source: 'MANUAL', title: 'Controller', companyName: 'Epsilon', createdAt: ago(3) })],
      now,
    })
    expect(r.items.map((i) => [i.key, i.status, i.origin])).toEqual([
      ['application:a2', 'interviewing', 'email'],
      ['external:abc', 'saved', 'tracker'],
      ['job_board:j1', 'saved', 'board'],
      ['posting:p1', 'saved', 'tracker'],
      ['surfaced:s1', 'saved', 'board'],
      ['application:a3', 'closed', 'tracker'],
    ])
    expect(r.cardStates.get('job_board:j3')).toEqual({ saved: false, status: null })
  })

  it('never lists the same application twice when it is both applied and in the saved list', () => {
    const a = app({ id: 'a1', source: 'MANUAL', title: 'Controller', appliedAt: ago(2) })
    const r = mergeMyJobItems({ tracked: [], surfaced: [], apps: [a], savedPostings: [a], now })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].key).toBe('application:a1')
  })

  it('hides a dismissed board job unless it was applied to', () => {
    const r = mergeMyJobItems({
      tracked: [
        tracked({ id: 't1', sourceId: 'j1', savedAt: ago(2), dismissedAt: ago(1) }),
        tracked({ id: 't2', sourceId: 'j2', dismissedAt: ago(1), jobPosting: app({ id: 'a9', appliedAt: ago(3) }) }),
      ],
      surfaced: [],
      apps: [],
      now,
    })
    expect(r.items.map((i) => i.key)).toEqual(['job_board:j2'])
  })

  it('skips a partner job already tracked on the board', () => {
    const r = mergeMyJobItems({
      tracked: [tracked({ id: 't1', source: 'surfaced', sourceId: 's1', savedAt: ago(1) })],
      surfaced: [{ id: 's1', title: 'CFO', companyName: 'Beta', url: null, description: null, reactedAt: ago(4), surfacedAt: ago(5) }],
      apps: [],
      now,
    })
    expect(r.items).toHaveLength(1)
  })
})
