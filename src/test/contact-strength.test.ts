import { describe, it, expect } from 'vitest'
import { contactStrength, strongerContact, type ContactPerson } from '@/lib/crm/contact-strength'

const now = new Date('2026-10-11T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const p = (o: Partial<ContactPerson> = {}): ContactPerson => ({ warmth: 'UNKNOWN', connectedAt: null, firstRepliedAt: null, lastTouchedAt: null, touchCount: 0, notes: null, ...o })

describe('contactStrength', () => {
  it('HOT warmth, or a recent reply, is hot', () => {
    expect(contactStrength(p({ warmth: 'HOT' }), now)).toBe('hot')
    expect(contactStrength(p({ firstRepliedAt: daysAgo(40), lastTouchedAt: daysAgo(30), touchCount: 3 }), now)).toBe('hot')
  })
  it('WARM warmth, a connection, an old reply or a touch in the last year is warm', () => {
    expect(contactStrength(p({ warmth: 'WARM' }), now)).toBe('warm')
    expect(contactStrength(p({ connectedAt: daysAgo(900) }), now)).toBe('warm')
    expect(contactStrength(p({ firstRepliedAt: daysAgo(400), lastTouchedAt: daysAgo(300) }), now)).toBe('warm')
    expect(contactStrength(p({ touchCount: 2, lastTouchedAt: daysAgo(200) }), now)).toBe('warm')
  })
  it('a touch more than a year old is not warm', () => {
    expect(contactStrength(p({ touchCount: 2, lastTouchedAt: daysAgo(500) }), now)).toBe('any')
  })
  it('a directory entry we added and nobody touched is not a contact', () => {
    expect(contactStrength(p({ notes: 'Director of X (WIOA local workforce board, TX). From the CareerOneStop directory: https://x' }), now)).toBeNull()
    expect(contactStrength(p({ notes: "Career Services at Y. From the college's own website: https://y" }), now)).toBeNull()
  })
  it('an auto-added person you have since connected with or contacted counts', () => {
    const notes = "Career Services at Y. From the college's own website: https://y"
    expect(contactStrength(p({ notes, connectedAt: daysAgo(10) }), now)).toBe('warm')
    expect(contactStrength(p({ notes, touchCount: 1, lastTouchedAt: daysAgo(10) }), now)).toBe('warm')
  })
  it('anyone else in the CRM is any', () => {
    expect(contactStrength(p(), now)).toBe('any')
  })
  it('orders strengths', () => {
    expect(strongerContact('any', 'warm')).toBe('warm')
    expect(strongerContact(null, 'any')).toBe('any')
    expect(strongerContact('hot', 'warm')).toBe('hot')
  })
})
