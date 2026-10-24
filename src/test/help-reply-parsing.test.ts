import { describe, expect, it } from 'vitest'
import { stripQuotedReply } from '@/lib/help/strip-quoted'
import { helpRequestIdFromLocal } from '@/lib/help/inbound-address'

describe('stripQuotedReply', () => {
  it('keeps only the new text above a Gmail quote', () => {
    const raw = 'Thanks, that fixed it.\n\nOn Fri, Oct 23, 2026 at 4:30 PM NextChapter <support@launchyournextchapter.com> wrote:\n> We found the cause.\n> Try again.'
    expect(stripQuotedReply(raw)).toBe('Thanks, that fixed it.')
  })
  it('cuts at our own "earlier in this conversation" marker', () => {
    const raw = 'Still broken for me.\n\n— Earlier in this conversation —\n\nYou · Oct 22\n> I cannot upload'
    expect(stripQuotedReply(raw)).toBe('Still broken for me.')
  })
  it('cuts Outlook original-message blocks and signatures', () => {
    expect(stripQuotedReply('Yes please.\n\n-----Original Message-----\nFrom: x\nSent: y')).toBe('Yes please.')
    expect(stripQuotedReply('Done.\n-- \nSam Lee\nAcme')).toBe('Done.')
  })
  it('returns empty when there is only quoted text', () => {
    expect(stripQuotedReply('> old\n> older')).toBe('')
  })
  it('keeps a multi-paragraph reply intact', () => {
    expect(stripQuotedReply('Line one.\n\nLine two.')).toBe('Line one.\n\nLine two.')
  })
})

describe('helpRequestIdFromLocal', () => {
  it('extracts the id from help-<id>', () => {
    expect(helpRequestIdFromLocal('help-cmabc123')).toBe('cmabc123')
  })
  it('ignores other addresses', () => {
    expect(helpRequestIdFromLocal('acme-firm')).toBeNull()
    expect(helpRequestIdFromLocal('help-')).toBeNull()
  })
})
