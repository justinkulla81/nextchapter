import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { selectNewMessageIds } from '@/lib/email-tracking/sync-gmail'

describe('selectNewMessageIds', () => {
  it('skips ids already tracked', () => {
    const r = selectNewMessageIds(['a', 'b'], ['c', 'd'], new Set(['a', 'c']))
    expect(r).toEqual({ newInboxIds: ['b'], newSentIds: ['d'] })
  })

  it('records mail sent to yourself once, on the inbound pass', () => {
    // "self" is in both INBOX and SENT — the cause of the duplicate-insert error.
    const r = selectNewMessageIds(['x', 'self'], ['self', 'y'], new Set())
    expect(r.newInboxIds).toEqual(['x', 'self'])
    expect(r.newSentIds).toEqual(['y'])
  })

  it('keeps a self-sent message on the sent pass only if it is not in the inbox list', () => {
    const r = selectNewMessageIds([], ['only-sent'], new Set())
    expect(r.newSentIds).toEqual(['only-sent'])
  })

  it('handles empty lists', () => {
    expect(selectNewMessageIds([], [], new Set())).toEqual({ newInboxIds: [], newSentIds: [] })
  })
})
