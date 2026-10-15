import { describe, expect, it } from 'vitest'
import { buildPlaybook, type PlaybookInput } from './playbook'

const base: PlaybookInput = {
  purpose: 'INFO_CHAT',
  askSize: 'MEDIUM',
  hook: 'THEIR_NEWS',
  hookDetail: 'your promotion to VP',
  contactFirstName: 'Dana',
  contactCompany: 'Acme',
  contactTitle: null,
  warmth: 'WARM',
  candidateFirstName: 'Sam',
  targetRole: 'product manager',
  discreet: false,
  offer: '',
  roleTitle: '',
  daysSinceLastContact: 200,
}

describe('buildPlaybook', () => {
  it('uses the hook detail and names the target role', () => {
    const r = buildPlaybook(base)
    expect(r.body).toContain('Hi Dana,')
    expect(r.body).toContain('your promotion to VP')
    expect(r.body).toContain('product manager')
    expect(r.body).toContain('Sam')
  })

  it('leaves a bracketed slot rather than a generic line when no hook detail is given', () => {
    const r = buildPlaybook({ ...base, hookDetail: '' })
    expect(r.body).toMatch(/\[their news/)
  })

  it('never announces a search in discreet mode', () => {
    for (const purpose of ['REACH_OUT', 'INFO_CHAT', 'ASK_INTRO', 'GIVE_FIRST', 'FOLLOW_UP'] as const) {
      const r = buildPlaybook({ ...base, purpose, discreet: true })
      expect(r.body).not.toMatch(/job search|looking for/i)
      expect(r.leaveBehind).not.toMatch(/looking for/i)
    }
  })

  it('warns on a big ask of a cold contact', () => {
    const r = buildPlaybook({ ...base, purpose: 'ASK_INTRO', askSize: 'BIG', warmth: 'COLD' })
    expect(r.warnings.join(' ')).toMatch(/big ask/i)
  })

  it('asks for the exact role title on a referral', () => {
    const r = buildPlaybook({ ...base, purpose: 'ASK_REFERRAL', askSize: 'BIG' })
    expect(r.warnings.join(' ')).toMatch(/role title/i)
    expect(r.subject).toContain('Acme')
  })

  it('adds the candidate offer when given', () => {
    const r = buildPlaybook({ ...base, offer: "I'll send you the market data I've collected" })
    expect(r.body).toContain("In return, I'll send you the market data I've collected.")
  })
})
