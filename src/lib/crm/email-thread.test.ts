import { describe, it, expect } from 'vitest'
import { latestReplyOnly, threadKey, groupEmailChains } from './email-thread'

describe('latestReplyOnly', () => {
  it('cuts at the Gmail "wrote:" line', () => {
    const body = "That works! I'll send a new invite. Speak soon. Justin On Thu, Oct 8, 2026 at 12:10 PM Kelly Gold <kgold@onelouisville.org> wrote: > Hi Justin"
    expect(latestReplyOnly(body)).toBe("That works! I'll send a new invite. Speak soon. Justin")
  })
  it('cuts at quoted > lines and Outlook headers', () => {
    expect(latestReplyOnly('Thanks!\n> older text')).toBe('Thanks!')
    expect(latestReplyOnly('Thanks!\n\nFrom: A <a@b.c>\nSent: Monday')).toBe('Thanks!')
  })
  it('leaves a body with no quote alone', () => {
    expect(latestReplyOnly('Hello there')).toBe('Hello there')
    expect(latestReplyOnly(null)).toBe('')
  })
})

describe('groupEmailChains', () => {
  it('joins Re:/Fwd: subjects and orders chains by latest activity', () => {
    const d = (n: number) => new Date(2026, 9, n)
    const chains = groupEmailChains([
      { id: '1', subject: 'Intro', occurredAt: d(1) },
      { id: '2', subject: 'Other', occurredAt: d(5) },
      { id: '3', subject: 'Re: Intro', occurredAt: d(3) },
    ])
    expect(chains.map((c) => c.messages.map((m) => m.id))).toEqual([['2'], ['1', '3']])
    expect(threadKey('RE: re: Intro ')).toBe('intro')
  })
})
