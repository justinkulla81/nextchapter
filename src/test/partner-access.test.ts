import { describe, expect, it } from 'vitest'
import { FREE_PARTNER_CONTACTS, accessBlocked, cleanEmail, emailMatches, partnerAccessPath, validEmail } from '@/lib/workforce/partner-access-rules'

const base = { plan: 'FREE', partnerStatus: 'CONFIRMED', email: 'dana@example.edu', contactsInOrg: 0, alreadyContact: false }

describe('partner access', () => {
  it('needs a real email and a confirmed partner', () => {
    expect(accessBlocked(base)).toBeNull()
    expect(accessBlocked({ ...base, email: 'nope' })).toMatch(/work email/)
    expect(accessBlocked({ ...base, partnerStatus: 'CLAIMED' })).toMatch(/Confirm this partner first/)
    expect(accessBlocked({ ...base, partnerStatus: 'INVITED' })).toMatch(/confirmed partners/)
  })
  it('caps a free organization at three contacts, never a paid one', () => {
    expect(accessBlocked({ ...base, contactsInOrg: FREE_PARTNER_CONTACTS - 1 })).toBeNull()
    expect(accessBlocked({ ...base, contactsInOrg: FREE_PARTNER_CONTACTS })).toMatch(/paid plan/)
    expect(accessBlocked({ ...base, plan: 'PAID', contactsInOrg: 50 })).toBeNull()
    // An unexpected plan value is paid, so a missing value never takes features away.
    expect(accessBlocked({ ...base, plan: null, contactsInOrg: 50 })).toBeNull()
  })
  it('a contact who already has access can be re-sent a link at the cap', () => {
    expect(accessBlocked({ ...base, contactsInOrg: FREE_PARTNER_CONTACTS, alreadyContact: true })).toBeNull()
  })
  it('compares emails without caring about case or spaces', () => {
    expect(cleanEmail('  Dana@Example.EDU ')).toBe('dana@example.edu')
    expect(validEmail('dana@example.edu')).toBe(true)
    expect(emailMatches('dana@example.edu', 'DANA@example.edu')).toBe(true)
    expect(emailMatches('dana@example.edu', 'someone@else.com')).toBe(false)
    expect(emailMatches('dana@example.edu', null)).toBe(false)
  })
  it('builds the one-time path', () => {
    expect(partnerAccessPath('demo', 'tok')).toBe('/i/demo/partner-account/tok')
  })
})
