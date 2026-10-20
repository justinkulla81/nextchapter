import { describe, expect, it } from 'vitest'
import { continuityCopy, endingSoon } from '@/lib/employer/seat-continuity'
import { PRIVACY_NOTE, enrollIntro, programKindOf } from '@/lib/employer/program-wording'

const now = new Date('2026-10-17T12:00:00Z')
const day = 86_400_000

describe('when a sponsored seat ends', () => {
  it('only warns in the last 30 days, and about the nearest seat', () => {
    expect(endingSoon([{ endsAt: new Date(now.getTime() + 40 * day), orgName: 'A', kind: 'GROWTH' }], now)).toBeNull()
    expect(endingSoon([{ endsAt: new Date(now.getTime() - day), orgName: 'A', kind: 'GROWTH' }], now)).toBeNull()
    const e = endingSoon([{ endsAt: new Date(now.getTime() + 20 * day), orgName: 'A', kind: 'GROWTH' }, { endsAt: new Date(now.getTime() + 9 * day), orgName: 'B', kind: 'OUTPLACEMENT' }], now)
    expect(e).toMatchObject({ orgName: 'B', daysLeft: 9 })
  })
  it('says a growth seat keeps the career story and never undoes the plan', () => {
    const c = continuityCopy('GROWTH')
    expect(c.stays.join(' ')).toMatch(/career story/)
    expect(c.next).toMatch(/Nothing changes about your plan/)
    expect(c.ends.join(' ')).not.toMatch(/career story|plan/)
  })
  it('keeps a laid-off member search plan', () => {
    expect(continuityCopy('OUTPLACEMENT').stays.join(' ')).toMatch(/search plan/)
  })
})

describe('employer portal wording', () => {
  it('tells outplacement from career growth', () => {
    expect(programKindOf(null)).toBe('OUTPLACEMENT')
    expect(programKindOf('LAID_OFF')).toBe('OUTPLACEMENT')
    expect(programKindOf('GROWING')).toBe('GROWTH')
  })
  it('promises counts only and keeps the career story private', () => {
    expect(PRIVACY_NOTE).toMatch(/career story/)
    expect(PRIVACY_NOTE).toMatch(/aggregate/)
  })
  it('explains a growth seat never overrides an existing plan', () => {
    expect(enrollIntro(['GROWTH'])).toMatch(/never changes a plan/)
    expect(enrollIntro(['OUTPLACEMENT'])).not.toMatch(/career growth/)
  })
})
