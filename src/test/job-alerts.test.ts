import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email/resend-client', () => ({ createResend: vi.fn(), isUndeliverableAddress: () => false }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/jobs/public-board', () => ({ searchPublicBoard: vi.fn() }))

import { DEFAULT_JOURNEY, inferJourney, journeyChoices } from '@/lib/leads/infer-journey'
import { searchLabel } from '@/lib/leads/job-alerts'
import { jobAlertDailyCap, jobAlertEmailsOn } from '@/lib/leads/job-alert-config'

describe('inferJourney', () => {
  it('prefers an earlier journey answer over the search words', () => {
    expect(inferJourney({ q: 'junior analyst' }, 'laid-off')).toEqual({ slug: 'laid-off', basis: 'earlier_answer' })
  })
  it('ignores an earlier answer that is not a real situation', () => {
    expect(inferJourney({ q: 'product manager' }, 'nonsense').basis).toBe('default')
  })
  it('reads new-grad and fractional hints from the search words', () => {
    expect(inferJourney({ q: 'entry level marketing' }).slug).toBe('new-grad')
    expect(inferJourney({ q: 'interim CFO' }).slug).toBe('happy-with-fractional-work')
  })
  it('falls back to the default', () => {
    expect(inferJourney({ q: 'product manager' })).toEqual({ slug: DEFAULT_JOURNEY, basis: 'default' })
  })
})

describe('journeyChoices', () => {
  it('puts the suggestion first, with no repeats, four in all', () => {
    const c = journeyChoices('laid-off')
    expect(c[0]).toBe('laid-off')
    expect(new Set(c).size).toBe(4)
  })
  it('keeps a suggestion that is not in the common list', () => {
    expect(journeyChoices('new-grad')[0]).toBe('new-grad')
  })
})

describe('searchLabel', () => {
  it('describes words, place and remote', () => {
    expect(searchLabel({ searchQ: 'marketing manager', searchLoc: 'Chicago', searchRemote: false })).toBe('marketing manager in Chicago')
    expect(searchLabel({ searchQ: '', searchLoc: '', searchRemote: true })).toBe('all new jobs remote')
    expect(searchLabel({ searchQ: 'analyst', searchLoc: '', searchRemote: true })).toBe('analyst (remote)')
  })
})

describe('config', () => {
  it('is off unless JOB_ALERT_EMAILS is exactly 1', () => {
    delete process.env.JOB_ALERT_EMAILS
    expect(jobAlertEmailsOn()).toBe(false)
    process.env.JOB_ALERT_EMAILS = 'true'
    expect(jobAlertEmailsOn()).toBe(false)
    process.env.JOB_ALERT_EMAILS = '1'
    expect(jobAlertEmailsOn()).toBe(true)
    delete process.env.JOB_ALERT_EMAILS
  })
  it('defaults the daily cap to 100 and honours a valid override', () => {
    delete process.env.JOB_ALERT_DAILY_CAP
    expect(jobAlertDailyCap()).toBe(100)
    process.env.JOB_ALERT_DAILY_CAP = '25'
    expect(jobAlertDailyCap()).toBe(25)
    delete process.env.JOB_ALERT_DAILY_CAP
  })
})
