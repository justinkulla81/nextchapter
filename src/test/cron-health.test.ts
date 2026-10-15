import { describe, it, expect, vi } from 'vitest'
import { assessJob } from '@/lib/cron/health'
import { intervalMinutes, maxGapMinutes, cronSchedules, RERUN_SAFE_JOBS } from '@/lib/cron/schedule'

const now = new Date('2026-10-13T12:00:00Z')
const min = (n: number) => new Date(now.getTime() - n * 60_000)
const daily = { maxGapMinutes: maxGapMinutes('0 12 * * *') }

describe('intervalMinutes', () => {
  it('reads the schedule shapes vercel.json uses', () => {
    expect(intervalMinutes('*/5 * * * *')).toBe(5)
    expect(intervalMinutes('0 * * * *')).toBe(60)
    expect(intervalMinutes('0 12 * * *')).toBe(1440)
    expect(intervalMinutes('0 9 * * 1')).toBe(7 * 1440)
    expect(intervalMinutes('30 11 */2 * *')).toBe(2 * 1440)
    expect(intervalMinutes('20 */3 * * *')).toBe(180)
  })
  it('covers every configured job, including the watchdog', () => {
    const jobs = cronSchedules()
    expect(jobs.map((j) => j.job)).toContain('job-health')
    expect(jobs.every((j) => j.maxGapMinutes > 0)).toBe(true)
  })
})

describe('assessJob', () => {
  it('is healthy after a recent OK run', () => {
    expect(assessJob(daily, { status: 'OK', startedAt: min(60) }, min(5000), now).health).toBe('healthy')
  })
  it('flags a failed last run with its error', () => {
    const r = assessJob(daily, { status: 'FAILED', startedAt: min(60), error: 'boom' }, min(5000), now)
    expect(r.health).toBe('failed')
    expect(r.detail).toContain('boom')
  })
  it('flags a run still RUNNING past the time limit as cut off, but not a fresh one', () => {
    expect(assessJob(daily, { status: 'RUNNING', startedAt: min(10) }, min(5000), now).health).toBe('timed_out')
    expect(assessJob(daily, { status: 'RUNNING', startedAt: min(1) }, min(5000), now).health).toBe('healthy')
  })
  it('flags a job that stopped starting', () => {
    expect(assessJob(daily, { status: 'OK', startedAt: min(3 * 1440) }, min(9000), now).health).toBe('overdue')
  })
  it('waits, rather than alerts, for a job with no runs right after the ledger began', () => {
    expect(assessJob(daily, null, min(30), now).health).toBe('waiting')
    expect(assessJob(daily, null, min(4000), now).health).toBe('overdue')
    expect(assessJob(daily, null, null, now).health).toBe('waiting')
  })
})

describe('RERUN_SAFE_JOBS', () => {
  it('only names configured jobs, and never a job that emails people', () => {
    const configured = new Set(cronSchedules().map((j) => j.job))
    for (const j of RERUN_SAFE_JOBS) expect(configured.has(j)).toBe(true)
    for (const j of ['job-search-daily', 'candidate-email-dispatch', 'mailing-send', 'market-reality-snapshot', 'interim-role-reverify']) {
      expect(RERUN_SAFE_JOBS.has(j)).toBe(false)
    }
  })
})

describe('alertSubject', () => {
  it('agrees with the count', async () => {
    vi.doMock('server-only', () => ({}))
    vi.doMock('@/lib/prisma', () => ({ prisma: {} }))
    vi.doMock('@/lib/email/resend-client', () => ({ createResend: vi.fn() }))
    vi.doMock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
    vi.doMock('@/lib/cron/invoke', () => ({ invokeCron: vi.fn() }))
    const { alertSubject } = await import('@/lib/cron/watchdog')
    expect(alertSubject(1)).toBe('1 background job needs attention')
    expect(alertSubject(2)).toBe('2 background jobs need attention')
  })
})
