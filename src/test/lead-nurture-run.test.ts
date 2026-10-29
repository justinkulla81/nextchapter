import { beforeEach, describe, expect, it, vi } from 'vitest'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-11-10T14:15:00Z')
const ago = (days: number) => new Date(now.getTime() - days * DAY)

const db = {
  leads: [] as Record<string, unknown>[],
  guides: [] as Record<string, unknown>[],
  persons: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  suppressed: [] as Record<string, unknown>[],
  members: [] as Record<string, unknown>[],
  unsubscribed: [] as Record<string, unknown>[],
  activities: [] as Record<string, unknown>[],
  sentToday: 0,
}
const leadQueries: { where: Record<string, unknown> }[] = []
const sendNurtureEmail = vi.fn()
const fileLeadInCrm = vi.fn()
const lifecycleAddresses = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    homepageLead: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        leadQueries.push(args)
        const { kind } = args.where
        if (typeof kind === 'string') return db.leads.filter((l) => l.kind === kind)
        return db.unsubscribed // the "who unsubscribed" read has no kind
      },
    },
    guideLead: { findMany: async () => db.guides },
    newsletterSubscriber: { findMany: async () => [] },
    crmPerson: { findMany: async () => db.persons },
    candidateProfile: { findMany: async () => db.profiles },
    mailingSuppression: { findMany: async () => db.suppressed },
    mailingListMember: { findMany: async () => db.members },
    crmActivity: { findMany: async () => db.activities, count: async () => db.sentToday },
  },
}))
vi.mock('@/lib/skills/ai-market-live', () => ({ loadAiMarket: async () => ({ asOf: '2026-10-26', overall: { rawPct: 44.7, likePct: 16.9, nAi: 12214, nBase: 16496 } }) }))
vi.mock('@/lib/skills/ai-market', () => ({ MIN_PER_SIDE: 30 }))
vi.mock('@/lib/leads/lifecycle/run', () => ({ lifecycleAddresses: (...a: unknown[]) => lifecycleAddresses(...a) }))
vi.mock('@/lib/leads/lifecycle/file-lead', () => ({ fileLeadInCrm: (...a: unknown[]) => fileLeadInCrm(...a), isInternalAddress: (e: string) => e.endsWith('@launchyournextchapter.com') }))
vi.mock('@/lib/leads/nurture/send', () => ({ sendNurtureEmail: (...a: unknown[]) => sendNurtureEmail(...a) }))

import { runLeadNurture } from '@/lib/leads/nurture/run'

const journey = (email: string, planDaysAgo: number, situation = 'laid-off') => ({ kind: 'journey', email, situation, followup: 'weeks', source: 'home', planSentAt: ago(planDaysAgo) })

describe('runLeadNurture', () => {
  beforeEach(() => {
    for (const k of Object.keys(db) as (keyof typeof db)[]) (db[k] as unknown) = Array.isArray(db[k]) ? [] : 0
    leadQueries.length = 0
    sendNurtureEmail.mockReset().mockResolvedValue(true)
    fileLeadInCrm.mockReset().mockResolvedValue('person_1')
    lifecycleAddresses.mockReset().mockResolvedValue(new Set())
    delete process.env.NURTURE_EMAILS
    delete process.env.NURTURE_DAILY_CAP
  })

  it('is a dry run by default: counts and subjects, no addresses, no sends, no CRM writes', async () => {
    db.leads = [journey('ann@example.org', 3), journey('bo@example.org', 7, 'promotion'), journey('cy@example.org', 1)]
    const summary = await runLeadNurture(now)
    expect(summary.mode).toBe('dry-run')
    expect(summary).toMatchObject({ considered: 3, due: 2, notDue: 1, sent: 0 })
    expect(summary.byStep).toEqual({ next_step: 1, data_point: 1, assessment: 0 })
    expect(summary.sampleSubjects.length).toBeGreaterThan(0)
    expect(summary.sampleSubjects).toEqual(expect.arrayContaining([expect.stringMatching(/^next_step: /), expect.stringMatching(/^data_point: /)]))
    expect(JSON.stringify(summary)).not.toMatch(/@/)
    expect(sendNurtureEmail).not.toHaveBeenCalled()
    expect(fileLeadInCrm).not.toHaveBeenCalled()
  })

  it('reports the AI data date the day-7 emails would quote', async () => {
    db.leads = [journey('a@example.org', 3)]
    expect((await runLeadNurture(now)).aiFactsAsOf).toBe('2026-10-26')
  })

  it('sends the due emails when the switch is on, filing each person in the CRM first', async () => {
    process.env.NURTURE_EMAILS = '1'
    db.leads = [journey('ann@example.org', 3), journey('bo@example.org', 3, 'new-grad')]
    const summary = await runLeadNurture(now)
    expect(summary).toMatchObject({ mode: 'on', due: 2, sent: 2, failed: 0, overCap: 0 })
    expect(fileLeadInCrm).toHaveBeenCalledTimes(2)
    expect(fileLeadInCrm.mock.calls[0][0]).toMatchObject({ channel: 'Journey picker' })
    const call = sendNurtureEmail.mock.calls[0][0]
    expect(call).toMatchObject({ email: 'ann@example.org', kind: 'journey', track: 'laid_off', step: 'next_step', personId: 'person_1' })
    expect(call.content.ctaPath).toBe('/resources/cobra-aca')
  })

  it('stops at the daily cap, counting what already went out today, and reports the rest as over cap', async () => {
    process.env.NURTURE_EMAILS = '1'
    process.env.NURTURE_DAILY_CAP = '3'
    db.sentToday = 2
    db.leads = [journey('a@example.org', 3), journey('b@example.org', 3), journey('c@example.org', 3)]
    const summary = await runLeadNurture(now)
    expect(summary).toMatchObject({ due: 3, sent: 1, overCap: 2, dailyCap: 3, sentToday: 2 })
    expect(sendNurtureEmail).toHaveBeenCalledTimes(1)
  })

  it('sends nothing at all with a cap of zero', async () => {
    process.env.NURTURE_EMAILS = '1'
    process.env.NURTURE_DAILY_CAP = '0'
    db.leads = [journey('a@example.org', 3)]
    const summary = await runLeadNurture(now)
    expect(summary).toMatchObject({ due: 1, sent: 0, overCap: 1 })
    expect(sendNurtureEmail).not.toHaveBeenCalled()
  })

  it('counts a failed send and carries on with the next person', async () => {
    process.env.NURTURE_EMAILS = '1'
    sendNurtureEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    db.leads = [journey('a@example.org', 3), journey('b@example.org', 3)]
    const summary = await runLeadNurture(now)
    expect(summary).toMatchObject({ sent: 1, failed: 1 })
  })

  it('skips members, people covered by the lifecycle emails, the unsubscribed and the bounced', async () => {
    process.env.NURTURE_EMAILS = '1'
    db.leads = ['member', 'life', 'unsub', 'bounce', 'ok'].map((n) => journey(`${n}@example.org`, 3))
    db.profiles = [{ email: 'Member@Example.org' }]
    lifecycleAddresses.mockResolvedValue(new Set(['life@example.org']))
    db.unsubscribed = [{ email: 'unsub@example.org' }]
    db.suppressed = [{ email: 'bounce@example.org' }]
    const summary = await runLeadNurture(now)
    expect(summary).toMatchObject({ considered: 5, registered: 1, ownedByLifecycle: 1, stopped: 2, due: 1, sent: 1 })
    expect(sendNurtureEmail.mock.calls[0][0].email).toBe('ok@example.org')
  })

  it('treats a CRM person linked to a candidate, by any of their addresses, as a member', async () => {
    db.leads = [journey('old@example.org', 3)]
    db.persons = [{ email: 'new@example.org', emails: ['new@example.org', 'old@example.org'], candidateId: 'cand_1' }]
    expect((await runLeadNurture(now)).registered).toBe(1)
  })

  it('never mails our own team’s addresses', async () => {
    db.leads = [journey('justin@launchyournextchapter.com', 3)]
    expect((await runLeadNurture(now)).considered).toBe(0)
  })

  it('only reads captures whose own email has gone out or whose confirmation was clicked, and never unsubscribed ones', async () => {
    await runLeadNurture(now)
    const byKind = (kind: string) => leadQueries.find((q) => q.where.kind === kind)!.where
    expect(byKind('journey')).toMatchObject({ unsubscribedAt: null, planSentAt: { gte: expect.any(Date) } })
    expect(byKind('deadline_reminders')).toMatchObject({ unsubscribedAt: null, confirmedAt: { gte: expect.any(Date) } })
    expect(byKind('layoff_alert')).toMatchObject({ unsubscribedAt: null, confirmedAt: { gte: expect.any(Date) } })
    expect(byKind('pay_check')).toMatchObject({ unsubscribedAt: null, planSentAt: { gte: expect.any(Date) } })
    // And it never reads a saved search or an applied job: those belong to the lifecycle emails.
    expect(leadQueries.some((q) => q.where.kind === 'job_alert' || q.where.kind === 'apply_save')).toBe(false)
  })

  it('does nothing and queries nothing further when there are no leads', async () => {
    const summary = await runLeadNurture(now)
    expect(summary).toMatchObject({ considered: 0, due: 0, sent: 0 })
    expect(lifecycleAddresses).not.toHaveBeenCalled()
  })
})
