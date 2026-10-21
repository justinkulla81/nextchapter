import { describe, expect, it } from 'vitest'
import { alertReadiness, type ContactCard, type ContactGroup } from './layoff-alert-rules'

const card = (o: Partial<ContactCard> = {}): ContactCard => ({ name: 'A B', title: null, org: null, email: null, phone: null, strength: null, href: null, ...o })
const group = (key: string, cards: ContactCard[]): ContactGroup => ({ key, label: key, why: '', cards, emptyHint: '' })

describe('alertReadiness', () => {
  const full = [
    group('head_hr', [card({ email: 'h@x.com' })]),
    group('rapid_response', [card()]),
    group('economic_development', [card()]),
    group('workforce_board', []),
  ]
  it('is ready with a place, an HR email and two public groups', () => {
    expect(alertReadiness(full, 'FL')).toEqual({ ready: true, missing: [] })
  })
  it('counts a guessed HR email but not a contact without one', () => {
    expect(alertReadiness([group('hr_team', [card({ email: 'g@x.com', guessed: true })]), ...full.slice(1)], 'FL').ready).toBe(true)
    expect(alertReadiness([group('head_hr', [card()]), ...full.slice(1)], 'FL').missing).toEqual(['an HR contact with an email address'])
  })
  it('names everything missing: the CSX alert had no state, no HR contact and one other contact', () => {
    const csx = [group('employer_other', [card({ email: null })]), group('head_hr', []), group('rapid_response', [])]
    const r = alertReadiness(csx, null)
    expect(r.ready).toBe(false)
    expect(r.missing).toHaveLength(3)
  })
  it('needs two public groups, not one', () => {
    expect(alertReadiness([full[0], full[1]], 'FL').ready).toBe(false)
  })
})
