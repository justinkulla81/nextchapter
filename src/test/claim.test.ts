import { describe, it, expect, beforeAll } from 'vitest'
import { claimUrl, verifyClaim, claimDrafts, firstNameOf } from '@/lib/crm/claim'

beforeAll(() => { process.env.LINK_SIGNING_SECRET = 'claim-test-secret-0123456789' })

describe('claim link', () => {
  it('round-trips for the person it was made for', () => {
    const url = new URL(claimUrl('https://example.com', 'person_1'))
    expect(url.pathname).toBe('/claim/person_1')
    expect(verifyClaim('person_1', url.searchParams.get('sig'))).toBe(true)
  })
  it('does not verify for another person, a missing or a tampered signature', () => {
    const sig = new URL(claimUrl('https://example.com', 'person_1')).searchParams.get('sig')
    expect(verifyClaim('person_2', sig)).toBe(false)
    expect(verifyClaim('person_1', null)).toBe(false)
    expect(verifyClaim('person_1', `${sig}x`)).toBe(false)
  })
})

describe('claim drafts', () => {
  const url = 'https://example.com/claim/p?sig=abc'
  it('puts the link and the opt-out in the email, and names the employer when known', () => {
    const d = claimDrafts({ firstName: 'Steven', orgName: 'SkillUp', url })
    expect(d.emailBody).toContain(url)
    expect(d.emailBody).toContain('reply "no"')
    expect(d.emailBody).toContain('your work at SkillUp')
    expect(d.linkedinText).toContain(url)
    expect(d.linkedinText).toContain('no resume needed')
  })
  it('stays honest when there is no employer on file', () => {
    expect(claimDrafts({ firstName: 'Sam', orgName: null, url }).emailBody).toContain('public information')
  })
  it('takes the first name from the record, else from the full name', () => {
    expect(firstNameOf('Steven Lee', 'Steve')).toBe('Steve')
    expect(firstNameOf('Steven Lee', null)).toBe('Steven')
  })
})
