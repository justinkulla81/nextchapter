import { describe, expect, it } from 'vitest'
import { cleanMemberWrite, cleanPersonData } from '@/lib/crm/generic-email-extension'
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

describe('a generic mailbox is never ACTIVE on a mailing list (owner, 2026-11-24)', () => {
  it('stores a new generic row as REMOVED, leaves a person alone', () => {
    const r = cleanMemberWrite('create', { data: { listId: 'l', email: 'info@acme.org', status: 'ACTIVE', addedVia: 'IMPORT' } }).data as Record<string, unknown>
    expect(r.status).toBe('REMOVED')
    const p = cleanMemberWrite('create', { data: { listId: 'l', email: 'pat@acme.org', addedVia: 'IMPORT' } }).data as Record<string, unknown>
    expect(p.status).toBeUndefined()
  })
  it('handles createMany and keeps an unsubscribe as it is', () => {
    const rows = cleanMemberWrite('createMany', { data: [{ email: 'hr@a.com' }, { email: 'pat@a.com' }, { email: 'jobs@a.com', status: 'UNSUBSCRIBED' }] }).data as Record<string, unknown>[]
    expect(rows.map((r) => r.status)).toEqual(['REMOVED', undefined, 'UNSUBSCRIBED'])
  })
  it('never reactivates a generic address', () => {
    const d = cleanMemberWrite('update', { where: { listId_email: { listId: 'l', email: 'careers@u.edu' } }, data: { status: 'ACTIVE' } }).data as Record<string, unknown>
    expect(d.status).toBe('REMOVED')
    const ok = cleanMemberWrite('update', { where: { listId_email: { listId: 'l', email: 'pat@u.edu' } }, data: { status: 'ACTIVE' } }).data as Record<string, unknown>
    expect(ok.status).toBe('ACTIVE')
  })
})
