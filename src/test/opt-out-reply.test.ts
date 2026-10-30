import { describe, expect, it } from 'vitest'
import { isOptOutReply } from '@/lib/outreach/opt-out'
import { renderEmail } from '@/lib/mailing/render'

describe('isOptOutReply', () => {
  it.each([
    ['Re: Quick question', 'No'],
    ['Re: Quick question', 'Stop.'],
    ['Re: Quick question', 'Please remove me from your list.\n\nOn Mon, Oct 5, 2026 at 9:00 AM Justin Kulla wrote:\n> Not interested? Just reply'],
    ['Re: Quick question', 'Not interested, thanks'],
    ['Re: Quick question', "Please don't email me again."],
    ['unsubscribe', ''],
  ])('treats %j / %j as a request to stop', (subject, body) => {
    expect(isOptOutReply(subject, body)).toBe(true)
  })

  it.each([
    ['Re: Quick question', 'Yes'],
    ['Re: Quick question', 'Yes, happy to talk Thursday'],
    ['Re: Quick question', 'Not interested, but talk to Dana, she owns this. Forwarding you now.'],
    ['Re: Quick question', 'No problem, send the numbers over'],
    ['Re: Quick question', 'Stop by my office next week?'],
    ['Re: Quick question', 'Not interested right now. Can you check back in March?'],
    ['Automatic reply: out of office', 'I am out of the office and not interested in anything until Monday.'],
  ])('leaves %j / %j for a person to read', (subject, body) => {
    expect(isOptOutReply(subject, body)).toBe(false)
  })

  it('ignores the quoted opt-out line in our own message', () => {
    expect(isOptOutReply('Re: Quick question', 'Sounds good, send it over.\n\nOn Mon, Oct 5 Justin wrote:\n> Not interested? Just reply and I\'ll take you off my list.')).toBe(false)
  })
})

describe('reply-to-opt-out footer', () => {
  const base = { bodyHtml: '<p>Hi</p>', merge: {} as never, postalAddress: '1 Main St, Boston MA', unsubscribeUrl: 'https://example.com/unsub' }
  it('adds no link when the footer says to reply', () => {
    const { html, text } = renderEmail({ ...base, footerText: "Not interested? Just reply and I'll take you off my list. NextChapter · {{postalAddress}}" })
    expect(html).not.toContain('example.com/unsub')
    expect(text).not.toContain('example.com/unsub')
    expect(text).toContain('1 Main St, Boston MA')
  })
  it('still adds a link to a footer that gives no way to reply', () => {
    const { html, text } = renderEmail({ ...base, footerText: 'NextChapter · {{postalAddress}}' })
    expect(html).toContain('example.com/unsub')
    expect(text).toContain('example.com/unsub')
  })
  it('keeps the link when the footer brackets one', () => {
    const { html } = renderEmail({ ...base, footerText: 'Reply or [unsubscribe here]. {{postalAddress}}' })
    expect(html).toContain('example.com/unsub')
  })
})
