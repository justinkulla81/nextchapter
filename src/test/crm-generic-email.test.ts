import { describe, expect, it } from 'vitest'
import { cleanPersonData } from '@/lib/crm/generic-email-extension'
import { isRoleAddress } from '@/lib/email/generic-address'

describe('CRM never stores a generic mailbox (owner, 2026-11-24)', () => {
  it('knows a shared mailbox from a person', () => {
    for (const e of ['info@acme.org', 'Careers@uni.edu', 'hr@acme.org', 'contactus@acme.org', 'contact.us@acme.org']) expect(isRoleAddress(e), e).toBe(true)
    for (const e of ['jane.doe@acme.org', 'lisab@cflouisville.org', 'infosec.lead@acme.org']) expect(isRoleAddress(e), e).toBe(false)
  })

  it('drops a generic address on create but keeps the person', () => {
    expect(cleanPersonData({ fullName: 'Bryan Zuber', email: 'info@carrollworks.com', emails: ['info@carrollworks.com'] }))
      .toEqual({ fullName: 'Bryan Zuber', email: null, emails: [] })
    expect(cleanPersonData({ fullName: 'Jane', email: 'jane@acme.org', emails: ['jane@acme.org', 'hr@acme.org'] }))
      .toEqual({ fullName: 'Jane', email: 'jane@acme.org', emails: ['jane@acme.org'] })
  })

  it('handles createMany rows, set and push', () => {
    expect(cleanPersonData([{ email: 'jobs@a.com' }, { email: 'pat@a.com' }])).toEqual([{ email: null }, { email: 'pat@a.com' }])
    expect(cleanPersonData({ email: { set: 'hello@a.com' }, emails: { set: ['hello@a.com', 'pat@a.com'] } }))
      .toEqual({ email: { set: null }, emails: { set: ['pat@a.com'] } })
    expect(cleanPersonData({ emails: { push: 'info@a.com' } })).toEqual({})
    expect(cleanPersonData({ emails: { push: ['info@a.com', 'pat@a.com'] } })).toEqual({ emails: { push: ['pat@a.com'] } })
    expect(cleanPersonData({ guessedEmail: 'careers@a.com', emailSource: 'hunter' })).toEqual({ guessedEmail: null, emailSource: 'hunter' })
  })

  it('leaves other writes alone', () => {
    expect(cleanPersonData({ fullName: 'X', priority: 'P2' })).toEqual({ fullName: 'X', priority: 'P2' })
    expect(cleanPersonData({ email: null })).toEqual({ email: null })
  })
})
