import { describe, expect, it } from 'vitest'
import { draftBackchannelNote, rankBackchannelContacts, type BackchannelContact } from '@/lib/email/backchannel-note'

const contact = (over: Partial<BackchannelContact> & { name: string }): BackchannelContact => ({
  title: null,
  email: null,
  warmth: 'WARM',
  employmentStatusAtCompany: null,
  ...over,
})

describe('rankBackchannelContacts', () => {
  it('drops contacts confirmed to have left', () => {
    const ranked = rankBackchannelContacts([contact({ name: 'Gone', employmentStatusAtCompany: 'FORMER' }), contact({ name: 'Here' })])
    expect(ranked.map((c) => c.name)).toEqual(['Here'])
  })

  it('prefers confirmed-current, then reachable, then warmest', () => {
    const ranked = rankBackchannelContacts([
      contact({ name: 'Cold', warmth: 'COLD', email: 'c@x.com' }),
      contact({ name: 'NoEmail', warmth: 'HOT' }),
      contact({ name: 'Hot', warmth: 'HOT', email: 'h@x.com' }),
      contact({ name: 'Confirmed', employmentStatusAtCompany: 'CURRENT' }),
    ])
    expect(ranked.map((c) => c.name)).toEqual(['Confirmed', 'Hot', 'Cold', 'NoEmail'])
  })
})

describe('draftBackchannelNote', () => {
  it('fills in role, company and names with no placeholders left', () => {
    const { subject, body } = draftBackchannelNote({ contactName: 'Dana Lee', role: 'Senior PM', companyName: 'Acme', senderFirstName: 'Justin' })
    expect(subject).toBe('Quick favor: Senior PM at Acme')
    expect(body).toContain('Hi Dana,')
    expect(body).toContain('applied for Senior PM at Acme')
    expect(body.endsWith('Justin')).toBe(true)
    expect(body).not.toMatch(/\[|\]/)
  })

  it('degrades cleanly without a role or sender name', () => {
    const { subject, body } = draftBackchannelNote({ contactName: 'Dana', role: null, companyName: 'Acme', senderFirstName: null })
    expect(subject).toBe('Quick favor: Acme')
    expect(body).toContain('applied for a role at Acme')
  })
})
