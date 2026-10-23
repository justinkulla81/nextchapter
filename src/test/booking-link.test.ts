import { describe, it, expect } from 'vitest'
import { looksLikeScanner } from '@/lib/booking'
import templates from '../../scripts/crm/outreach-templates.json'

describe('looksLikeScanner', () => {
  it('flags mail scanners and empty agents, not browsers', () => {
    expect(looksLikeScanner(null)).toBe(true)
    expect(looksLikeScanner('Mozilla/5.0 (compatible; Proofpoint)')).toBe(true)
    expect(looksLikeScanner('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605 Safari/605')).toBe(false)
  })
})

describe('follow-up templates carry the booking line', () => {
  it('has a booking link in every follow-up, and the first email has none', () => {
    for (const t of templates.templates) {
      expect(t.fu1).toContain('{{book_link_1}}')
      expect(t.fu2).toContain('{{book_link_2}}')
      expect(t.body).not.toMatch(/book_link/)
    }
  })
})
