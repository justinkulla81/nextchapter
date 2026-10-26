import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email/resend-client', () => ({ createResend: vi.fn(), isUndeliverableAddress: () => false }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/warn/layoff-pages', () => ({ getPublicNotices: vi.fn() }))
vi.mock('@/lib/notifications/member-notifications', () => ({ notifyMember: vi.fn() }))
vi.mock('@/lib/leads/job-alerts', () => ({ sentToday: vi.fn() }))

import { layoffWatchLabel, prettySlug } from '@/lib/leads/layoff-alerts'
import { layoffAlertEmailsOn } from '@/lib/leads/job-alert-config'

describe('layoff watch labels', () => {
  it('rebuilds a readable name from the slug', () => {
    expect(prettySlug('acme-corp')).toBe('Acme Corp')
  })
  it('names an employer, an employer in a state, a state, or the default', () => {
    expect(layoffWatchLabel({ searchQ: 'acme-corp', searchLoc: '' })).toBe('Acme Corp')
    expect(layoffWatchLabel({ searchQ: 'acme-corp', searchLoc: 'OH' })).toBe('Acme Corp in Ohio')
    expect(layoffWatchLabel({ searchQ: '', searchLoc: 'OH' })).toBe('Ohio')
    expect(layoffWatchLabel({ searchQ: '', searchLoc: '' })).toBe('new layoff notices')
  })
})

describe('layoff emails switch', () => {
  it('is off unless LAYOFF_ALERT_EMAILS is exactly 1', () => {
    delete process.env.LAYOFF_ALERT_EMAILS
    expect(layoffAlertEmailsOn()).toBe(false)
    process.env.LAYOFF_ALERT_EMAILS = '1'
    expect(layoffAlertEmailsOn()).toBe(true)
    delete process.env.LAYOFF_ALERT_EMAILS
  })
})
