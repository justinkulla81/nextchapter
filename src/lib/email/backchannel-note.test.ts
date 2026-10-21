import { describe, expect, it } from 'vitest'
import { draftBackchannelNote, rankBackchannelContacts, titleApplicability, type BackchannelContact } from '@/lib/email/backchannel-note'

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

  it('puts email first, then warmest, then confirmed-current', () => {
    const ranked = rankBackchannelContacts([
      contact({ name: 'Cold', warmth: 'COLD', email: 'c@x.com' }),
      contact({ name: 'NoEmail', warmth: 'HOT' }),
      contact({ name: 'Hot', warmth: 'HOT', email: 'h@x.com' }),
      contact({ name: 'Confirmed', email: 'w@x.com', employmentStatusAtCompany: 'CURRENT' }),
    ])
    expect(ranked.map((c) => c.name)).toEqual(['Hot', 'Confirmed', 'Cold', 'NoEmail'])
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
    expect(body).toContain('applied to Acme')
  })
})

describe('ranking order: email, then warmth, then role fit', () => {
  const c = (over: Partial<BackchannelContact> & { name: string }): BackchannelContact => ({
    title: null,
    email: null,
    warmth: 'WARM',
    employmentStatusAtCompany: null,
    ...over,
  })

  it('puts people with an email ahead of warmer people without one', () => {
    const ranked = rankBackchannelContacts([c({ name: 'HotNoEmail', warmth: 'HOT' }), c({ name: 'ColdEmail', warmth: 'COLD', email: 'a@x.com' })])
    expect(ranked.map((x) => x.name)).toEqual(['ColdEmail', 'HotNoEmail'])
  })

  it('orders by warmth among people with email', () => {
    const ranked = rankBackchannelContacts([c({ name: 'Cold', warmth: 'COLD', email: 'a@x.com' }), c({ name: 'Hot', warmth: 'HOT', email: 'b@x.com' })])
    expect(ranked.map((x) => x.name)).toEqual(['Hot', 'Cold'])
  })

  it('breaks ties by fit with the role', () => {
    const ranked = rankBackchannelContacts(
      [
        c({ name: 'Sales', title: 'Sales director', email: 'a@x.com' }),
        c({ name: 'Product', title: 'Director of Product', email: 'b@x.com' }),
        c({ name: 'Recruiter', title: 'Technical recruiter', email: 'c@x.com' }),
      ],
      'Senior product manager'
    )
    expect(ranked.map((x) => x.name)).toEqual(['Recruiter', 'Product', 'Sales'])
  })

  it('scores a hiring-manager tag highest', () => {
    expect(titleApplicability({ title: null, relationshipTags: ['HIRING_MANAGER'] }, null)).toBe(3)
    expect(titleApplicability({ title: null, relationshipTags: [] }, 'Product manager')).toBe(0)
  })
})
