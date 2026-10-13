import { describe, it, expect } from 'vitest'
import { rateProspect, isDecisionMakerTitle, type ProspectInput } from '@/lib/crm/org-prospect'

const base: ProspectInput = {
  layoff: { notices: 0, employees: null, daysSinceLatest: null, hiringAgain: false },
  openRoles: 0, seniorRoles: 0,
  candidatesApplied: 0, candidatesWhoWorkedHere: 0,
  contacts: 0, decisionMakers: 0, routesIn: 0, meetings: 0, daysSinceLastTouch: null,
  inTheNews: 0, leadQuality: 'UNGRADED', dealStatus: null, opportunities: 0,
}

describe('rateProspect', () => {
  it('rates an org we know nothing about as cold, and says what is missing', () => {
    const r = rateProspect(base)
    expect(r.band).toBe('cold')
    expect(r.cautions).toContain('No one in the CRM here yet')
    expect(r.reasons).toEqual([])
  })

  it('never exceeds 100', () => {
    const r = rateProspect({
      ...base,
      layoff: { notices: 4, employees: 5000, daysSinceLatest: 10, hiringAgain: false },
      openRoles: 80, seniorRoles: 20, candidatesApplied: 12, candidatesWhoWorkedHere: 9,
      contacts: 9, decisionMakers: 4, routesIn: 3, meetings: 5, inTheNews: 3, leadQuality: 'A', dealStatus: 'CUSTOMER',
    })
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.band).toBe('hot')
  })

  it('scores a fresh layoff above an old one', () => {
    const fresh = rateProspect({ ...base, layoff: { notices: 1, employees: 200, daysSinceLatest: 20, hiringAgain: false } })
    const old = rateProspect({ ...base, layoff: { notices: 1, employees: 200, daysSinceLatest: 400, hiringAgain: false } })
    expect(fresh.score).toBeGreaterThan(old.score)
  })

  it('discounts a layoff the company has already hired back from', () => {
    const l = { notices: 1, employees: 500, daysSinceLatest: 30 }
    const still = rateProspect({ ...base, layoff: { ...l, hiringAgain: false } })
    const back = rateProspect({ ...base, layoff: { ...l, hiringAgain: true } })
    expect(back.score).toBeLessThan(still.score)
    expect(back.cautions).toContain('Already hiring again after its layoff')
  })

  it('keeps a lost deal cold however strong the signals', () => {
    const r = rateProspect({
      ...base, dealStatus: 'LOST', openRoles: 30, contacts: 3, decisionMakers: 2,
      layoff: { notices: 2, employees: 2000, daysSinceLatest: 5, hiringAgain: false },
    })
    expect(r.band).toBe('cold')
    expect(r.cautions).toContain('Marked lost')
  })

  it('flags a thin relationship: contacts but no decision maker, and a stale touch', () => {
    const r = rateProspect({ ...base, contacts: 2, daysSinceLastTouch: 200 })
    expect(r.cautions).toContain('No HR / people / executive contact yet')
    expect(r.cautions).toContain('Not contacted in 200 days')
  })

  it('lists reasons best first', () => {
    const r = rateProspect({ ...base, openRoles: 12, contacts: 1 })
    expect(r.reasons[0]).toMatch(/open role/)
  })
})

describe('isDecisionMakerTitle', () => {
  it.each([
    ['Chief Human Resources Officer', true],
    ['VP, Talent Acquisition', true],
    ['Chief Sustainability Officer and EVP', true],
    ['Software Engineer', false],
    [null, false],
  ])('%s -> %s', (title, expected) => {
    expect(isDecisionMakerTitle(title)).toBe(expected)
  })
})
