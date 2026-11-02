import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  leads: [] as Array<Record<string, unknown>>,
  person: { id: 'person_1' } as { id: string } | null,
  logged: false,
  send: vi.fn(),
  created: vi.fn(),
  deleted: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    homepageLead: { findMany: async () => db.leads, count: async () => 0, update: async () => ({}), updateMany: async () => ({}) },
    crmPerson: { findFirst: async () => db.person },
    crmActivity: {
      findFirst: async () => (db.logged ? { id: 'a0' } : null),
      create: async (args: unknown) => {
        db.created(args)
        return { id: 'a1' }
      },
      delete: async (args: unknown) => db.deleted(args),
    },
  },
}))
vi.mock('@/lib/email/resend-client', () => ({ createResend: () => ({ emails: { send: db.send } }), isUndeliverableAddress: () => false }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/jobs/public-board', () => ({ searchPublicBoard: vi.fn() }))

import { confirmReminderRef, sendConfirmReminders } from '@/lib/leads/job-alerts'

const lead = { id: 'lead_1', email: 'A@Example.org', unsubscribeToken: 'tok', searchQ: 'analyst', searchLoc: '', searchRemote: false }

beforeEach(() => {
  db.leads = [lead]
  db.person = { id: 'person_1' }
  db.logged = false
  db.send.mockReset().mockResolvedValue({ error: null })
  db.created.mockClear()
  db.deleted.mockClear()
  process.env.RESEND_API_KEY = 'test'
  process.env.JOB_ALERT_EMAILS = '1'
})

describe('sendConfirmReminders', () => {
  it('sends one reminder and logs it on the CRM person', async () => {
    expect(await sendConfirmReminders()).toBe(1)
    expect(db.send).toHaveBeenCalledTimes(1)
    expect(db.created.mock.calls[0][0]).toMatchObject({ data: { type: 'EMAIL', personId: 'person_1', sourceRef: confirmReminderRef('lead_1') } })
  })

  it('never sends the same reminder twice', async () => {
    db.logged = true
    expect(await sendConfirmReminders()).toBe(0)
    expect(db.send).not.toHaveBeenCalled()
  })

  it('removes its log row when the send fails, so the next run can retry', async () => {
    db.send.mockResolvedValue({ error: { message: 'bounced' } })
    expect(await sendConfirmReminders()).toBe(0)
    expect(db.deleted).toHaveBeenCalledTimes(1)
  })

  it('only counts, and sends nothing, while job alert emails are off', async () => {
    process.env.JOB_ALERT_EMAILS = '0'
    expect(await sendConfirmReminders()).toBe(1)
    expect(db.send).not.toHaveBeenCalled()
    expect(db.created).not.toHaveBeenCalled()
  })

  it('skips an address with no CRM record', async () => {
    db.person = null
    expect(await sendConfirmReminders()).toBe(0)
    expect(db.send).not.toHaveBeenCalled()
  })
})
