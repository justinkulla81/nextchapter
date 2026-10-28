import { beforeEach, describe, expect, it, vi } from 'vitest'

const H = 60 * 60 * 1000
const now = new Date('2026-10-28T12:00:00Z')
const ago = (hours: number) => new Date(now.getTime() - hours * H)

const db = {
  homepageLead: [] as Record<string, unknown>[],
  newsletter: [] as Record<string, unknown>[],
  waitlist: [] as Record<string, unknown>[],
  persons: [] as Record<string, unknown>[],
  suppressed: [] as Record<string, unknown>[],
  members: [] as Record<string, unknown>[],
  unsubscribedHome: [] as Record<string, unknown>[],
  sent: [] as Record<string, unknown>[],
}
const sendLifecycleEmail = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    homepageLead: {
      findMany: async ({ where }: { where: { kind?: string; unsubscribedAt?: unknown } }) =>
        where.kind ? db.homepageLead.filter((l) => l.kind === where.kind) : db.unsubscribedHome,
    },
    newsletterSubscriber: { findMany: async ({ where }: { where: { unsubscribedAt?: unknown } }) => (where.unsubscribedAt === null ? db.newsletter : []) },
    waitlistSignup: { findMany: async () => db.waitlist },
    crmPerson: { findMany: async () => db.persons },
    mailingSuppression: { findMany: async () => db.suppressed },
    mailingListMember: { findMany: async () => db.members },
    crmActivity: { findMany: async () => db.sent },
  },
}))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ getPublicJob: async () => null }))
vi.mock('@/lib/leads/lifecycle/file-lead', () => ({ fileLeadInCrm: async () => 'person_1', isInternalAddress: (e: string) => e.endsWith('@launchyournextchapter.com') }))
vi.mock('@/lib/leads/lifecycle/send', () => ({ lifecycleRef: (s: string, e: string) => `lifecycle:${s}:${e}`, sendLifecycleEmail: (...a: unknown[]) => sendLifecycleEmail(...a) }))

import { runLeadLifecycle } from '@/lib/leads/lifecycle/run'

describe('runLeadLifecycle', () => {
  beforeEach(() => {
    for (const k of Object.keys(db) as (keyof typeof db)[]) db[k] = []
    sendLifecycleEmail.mockReset().mockResolvedValue(true)
    process.env.LEAD_LIFECYCLE_EMAILS = '1'
  })

  it('welcomes a confirmed job alert and acknowledges a business waitlist signup, skipping members mid-signup', async () => {
    db.homepageLead = [{ kind: 'job_alert', email: 'Alert@Example.org', searchQ: 'product manager', searchLoc: 'Denver', confirmedAt: ago(1) }]
    db.waitlist = [
      { audience: 'Employer', payload: { email: 'hr@acme.example' }, createdAt: ago(2) },
      { audience: 'onboarding_no_gmail', payload: { email: 'member@example.org' }, createdAt: ago(2) },
      { audience: 'friend_referral', payload: { friendEmail: 'friend@example.org' }, createdAt: ago(2) },
    ]
    const summary = await runLeadLifecycle(now)
    const calls = sendLifecycleEmail.mock.calls.map(([c]) => ({ email: c.email, variant: c.variant, step: c.step }))
    expect(calls).toEqual(
      expect.arrayContaining([
        { email: 'alert@example.org', variant: 'job_alert', step: 'welcome' },
        { email: 'hr@acme.example', variant: 'waitlist_b2b', step: 'welcome' },
      ]),
    )
    expect(calls).toHaveLength(2)
    expect(summary.steps.welcome).toBe(2)
  })

  it('sends nothing to someone registered, unsubscribed, on the stop list or off the website-leads list', async () => {
    db.newsletter = ['reg', 'unsub', 'stop', 'off'].map((n) => ({ email: `${n}@example.org`, createdAt: ago(1) }))
    db.persons = [{ id: 'p1', email: 'reg@example.org', candidateId: 'cand_1' }]
    db.unsubscribedHome = [{ email: 'unsub@example.org' }]
    db.suppressed = [{ email: 'stop@example.org' }]
    db.members = [{ email: 'off@example.org', status: 'UNSUBSCRIBED' }]
    const summary = await runLeadLifecycle(now)
    expect(sendLifecycleEmail).not.toHaveBeenCalled()
    expect(summary.registered).toBe(1)
    expect(summary.stopped).toBe(3)
  })

  it('is a dry run unless the switch is on: counts what it would send, sends nothing', async () => {
    delete process.env.LEAD_LIFECYCLE_EMAILS
    db.newsletter = [{ email: 'new@example.org', createdAt: ago(1) }]
    const summary = await runLeadLifecycle(now)
    expect(summary.mode).toBe('dry-run')
    expect(summary.steps.welcome).toBe(1)
    expect(sendLifecycleEmail).not.toHaveBeenCalled()
  })

  it('does not mail the back catalogue: a signup from last week gets no welcome', async () => {
    db.newsletter = [{ email: 'old@example.org', createdAt: ago(24 * 7) }]
    await runLeadLifecycle(now)
    expect(sendLifecycleEmail).not.toHaveBeenCalled()
  })

  it('sends the first reminder once the welcome is old enough, and never the same step twice', async () => {
    db.newsletter = [{ email: 'old@example.org', createdAt: ago(24 * 8) }]
    db.sent = [{ sourceRef: 'lifecycle:welcome:old@example.org', occurredAt: ago(24 * 8) }]
    await runLeadLifecycle(now)
    expect(sendLifecycleEmail.mock.calls[0][0]).toMatchObject({ step: 'nudge1', variant: 'newsletter' })

    sendLifecycleEmail.mockClear()
    db.sent.push({ sourceRef: 'lifecycle:nudge1:old@example.org', occurredAt: ago(24) })
    await runLeadLifecycle(now)
    expect(sendLifecycleEmail).not.toHaveBeenCalled()
  })
})
