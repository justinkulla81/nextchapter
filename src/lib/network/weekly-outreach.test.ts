import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  backchannel: vi.fn(),
  reminders: vi.fn(),
  contacts: vi.fn(),
  logs: vi.fn(),
}))

vi.mock('@/lib/network/backchannel', () => ({ getBackchannelMatches: mocks.backchannel }))
vi.mock('@/lib/network/reminders', () => ({ getEmailReminders: mocks.reminders }))
vi.mock('@/lib/prisma', () => ({
  prisma: { supportNetworkContact: { findMany: mocks.contacts }, outreachLog: { findMany: mocks.logs } },
}))

import { getWeeklyOutreachPlan } from './weekly-outreach'

const match = (company: string, ids: string[]) => ({
  job: { id: `job-${company}`, title: 'PM', companyName: company, appliedAt: new Date() },
  contacts: ids.map((id) => ({ id, name: `Person ${id}`, title: null, email: null, linkedinUrl: null })),
  isNew: false,
})

describe('getWeeklyOutreachPlan', () => {
  beforeEach(() => {
    mocks.backchannel.mockResolvedValue([])
    mocks.reminders.mockResolvedValue([])
    mocks.contacts.mockResolvedValue([])
    mocks.logs.mockResolvedValue([])
  })

  it('ranks applied-company contacts above starred above quiet warm ties', async () => {
    mocks.backchannel.mockResolvedValue([match('Acme', ['a'])])
    mocks.reminders.mockResolvedValue([
      { contactId: 's', name: 'Star', company: null, email: null, linkedinUrl: null, daysSinceLastOutreach: null, lastOutreachAt: null },
    ])
    mocks.contacts.mockResolvedValue([{ id: 'w', name: 'Warm', company: null }])
    const plan = await getWeeklyOutreachPlan('c1')
    expect(plan.map((p) => p.contactId)).toEqual(['a', 's', 'w'])
    expect(plan[0]).toMatchObject({ purpose: 'ASK_REFERRAL', askSize: 'BIG', roleTitle: 'PM' })
    expect(plan[2]).toMatchObject({ purpose: 'REACH_OUT', askSize: 'SMALL' })
  })

  it('skips people written to in the last two weeks and dedupes', async () => {
    mocks.backchannel.mockResolvedValue([match('Acme', ['a', 'b']), match('Beta', ['b'])])
    mocks.logs.mockResolvedValue([{ contactId: 'a' }])
    const plan = await getWeeklyOutreachPlan('c1')
    expect(plan.map((p) => p.contactId)).toEqual(['b'])
  })

  it('caps the list at five', async () => {
    mocks.contacts.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, name: `W${i}`, company: null })))
    expect(await getWeeklyOutreachPlan('c1')).toHaveLength(5)
  })
})
