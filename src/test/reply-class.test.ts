import { describe, expect, it } from 'vitest'
import { classifyReply, ownText, replyClassOf, replyOutcome } from '@/lib/outreach/reply-class'

describe('classifyReply', () => {
  it('reads an out-of-office as automatic', () => {
    expect(classifyReply('Automatic reply: Support for the 109 people', 'I am out of the office until Monday.')).toBe('auto')
  })
  it('reads a stop request as no', () => {
    expect(classifyReply('Re: Support', 'Not interested, please remove me from your list.')).toBe('no')
    expect(classifyReply('Re: x', 'no')).toBe('other')
    expect(classifyReply('Re: x', 'Please stop emailing me.')).toBe('no')
  })
  it('reads interest as positive', () => {
    expect(classifyReply('Re: Support', 'Yes, please send the one-pager. Happy to talk next week.')).toBe('positive')
    expect(classifyReply('Re: Support', "Sounds interesting, let's set up a call.")).toBe('positive')
  })
  it('reads a hand-off as a referral', () => {
    expect(classifyReply('Re: Support', 'You should talk to Dana Cho, she owns the transition. Looping her in.')).toBe('referral')
  })
  it('reads a bare question as a question and the rest as other', () => {
    expect(classifyReply('Re: Support', 'How much does this cost?')).toBe('question')
    expect(classifyReply('Re: Support', 'Thanks for reaching out.')).toBe('other')
  })
  it('ignores the quoted message under the reply', () => {
    const body = 'Thanks.\n\nOn Tue, Oct 20, 2026 at 3:05 PM Justin Kulla <justin@x.com> wrote:\n> We would love to set up a call and schedule a demo.'
    expect(ownText('Re: x', body)).not.toContain('demo')
    expect(classifyReply('Re: x', body)).toBe('other')
  })
  it('round-trips through the outcome text', () => {
    expect(replyClassOf(replyOutcome('positive'))).toBe('positive')
    expect(replyClassOf(null)).toBeNull()
  })
})
