import { describe, expect, it } from 'vitest'
import { canAnswer, canFinish, canSendReferral, canWithdraw, referralText, roundedPeople, validateAnswer, validateReferral } from '@/lib/workforce/partner-referrals'
import { featureOn, institutionEntitlements } from '@/lib/plans/entitlements'

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) })
const now = new Date('2026-11-18T12:00:00Z')

describe('referrals to partners', () => {
  it('a free organization sends three; paid and trial send as many as they like', () => {
    expect(canSendReferral(3, 2).allowed).toBe(true)
    expect(canSendReferral(3, 3)).toMatchObject({ allowed: false, message: expect.stringMatching(/3 referrals/) })
    expect(canSendReferral(null, 99).allowed).toBe(true)
    expect(institutionEntitlements({ plan: 'FREE' }).referralLimit).toBe(3)
    expect(featureOn(institutionEntitlements({ plan: 'FREE' }), 'partnerReferrals')).toBe(false)
    expect(featureOn(institutionEntitlements({ plan: 'PAID' }), 'partnerReferrals')).toBe(true)
  })
  it('shows a group only as a rounded count, and nothing under five', () => {
    expect(roundedPeople(null)).toBeNull()
    expect(roundedPeople(4)).toBeNull()
    expect(roundedPeople(5)).toBe(5)
    expect(roundedPeople(38)).toBe(40)
    expect(roundedPeople(41)).toBe(40)
  })
  it('reads one as typed, and says what to fix', () => {
    const ok = { partnerId: 'p1', title: ' Take 40 managers ', message: '', cohortId: 'c1', offeringId: '', dueDate: '2026-12-15' }
    const r = validateReferral(form(ok), now)
    expect('value' in r && r.value).toMatchObject({ partnerId: 'p1', title: 'Take 40 managers', message: null, cohortId: 'c1', offeringId: null })
    expect(validateReferral(form({ ...ok, partnerId: '' }), now)).toMatchObject({ error: expect.stringMatching(/partner/) })
    expect(validateReferral(form({ ...ok, title: ' ' }), now)).toMatchObject({ error: expect.stringMatching(/what you are asking/i) })
    expect(validateReferral(form({ ...ok, dueDate: '12/15' }), now)).toMatchObject({ error: expect.stringMatching(/look like/) })
    expect(validateReferral(form({ ...ok, dueDate: '2026-01-01' }), now)).toMatchObject({ error: expect.stringMatching(/passed/) })
  })
  it('a decline needs a reason; an accept does not', () => {
    expect(validateAnswer(form({ decision: 'ACCEPTED', note: '' }))).toEqual({ value: { status: 'ACCEPTED', note: null } })
    expect(validateAnswer(form({ decision: 'DECLINED', note: '' }))).toMatchObject({ error: expect.stringMatching(/why/) })
    expect(validateAnswer(form({ decision: 'DECLINED', note: 'No seats until spring' }))).toEqual({ value: { status: 'DECLINED', note: 'No seats until spring' } })
    expect(validateAnswer(form({ decision: 'MAYBE' }))).toMatchObject({ error: expect.stringMatching(/accept or decline/) })
  })
  it('the partner answers once; the sender finishes only what was accepted', () => {
    expect(canAnswer('SENT')).toBe(true)
    expect(canAnswer('ACCEPTED')).toBe(false)
    expect(canFinish('ACCEPTED')).toBe(true)
    expect(canFinish('SENT')).toBe(false)
    expect(canWithdraw('SENT') && canWithdraw('ACCEPTED')).toBe(true)
    expect(canWithdraw('DONE') || canWithdraw('DECLINED')).toBe(false)
  })
  it('drafts the message and says no one is named', () => {
    const t = referralText({ from: 'Live in Lou', partner: 'A partner college', title: 'Take managers', people: 40, cohort: 'Operations managers', offering: 'Lean Six Sigma', due: 'Dec 15, 2026', message: null })
    expect(t).toMatch(/about 40 people, in our Operations managers group, for Lean Six Sigma/)
    expect(t).toMatch(/No one is named/)
  })
})
