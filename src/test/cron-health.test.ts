import { describe, it, expect, vi } from 'vitest'
import { assessJob, forgiveOneOff } from '@/lib/cron/health'
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

describe('first-seen markers', () => {
  it('re-times a never-run job whose schedule changed since it was first seen', async () => {
    vi.resetModules()
    vi.doMock('server-only', () => ({}))
    vi.doMock('@/lib/email/resend-client', () => ({ createResend: vi.fn() }))
    vi.doMock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
    vi.doMock('@/lib/cron/invoke', () => ({ invokeCron: vi.fn() }))
    const sched = [{ job: 'social-posts', path: '/api/cron/social-posts', schedule: '0 13 * * *', maxGapMinutes: 2940 }]
    vi.doMock('@/lib/cron/schedule', () => ({ cronSchedules: () => sched, RERUN_SAFE_JOBS: new Set() }))
    const upsert = vi.fn(async () => ({}))
    const old = new Date('2026-10-26T00:00:00Z')
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        cronRun: { findMany: async () => [] },
        cronJobAlert: { findMany: async () => [{ job: 'social-posts', reason: 'first_seen:0 13 * * 1', alertedAt: old }], upsert },
      },
    }))
    const { loadJobStatuses, firstSeenReason } = await import('@/lib/cron/watchdog')
    const now = new Date('2026-10-30T02:30:00Z')
    const [st] = await loadJobStatuses(now, { recordFirstSeen: true })
    expect(st.health).toBe('waiting')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { job: 'social-posts', reason: firstSeenReason('0 13 * * *'), alertedAt: now } }))
  })
})

describe('forgiveOneOff / isTransientDbError', () => {
  const frequent = { maxGapMinutes: 80 }
  const daily = { maxGapMinutes: 2940 }
  it('forgives a single bad run of a frequent job after a good one', () => {
    const r = forgiveOneOff(frequent, { health: 'timed_out', detail: 'x' }, 'OK')
    expect(r.health).toBe('healthy')
  })
  it('still flags two bad runs in a row, a first run, and daily jobs', () => {
    expect(forgiveOneOff(frequent, { health: 'timed_out', detail: 'x' }, 'TIMED_OUT').health).toBe('timed_out')
    expect(forgiveOneOff(frequent, { health: 'failed', detail: 'x' }, undefined).health).toBe('failed')
    expect(forgiveOneOff(daily, { health: 'failed', detail: 'x' }, 'OK').health).toBe('failed')
  })
  it('does not forgive overdue jobs', () => {
    expect(forgiveOneOff(frequent, { health: 'overdue', detail: 'x' }, 'OK').health).toBe('overdue')
  })
  it('treats pool timeouts as transient but statement timeouts as not', async () => {
    const { isTransientDbError } = await import('@/lib/cron/run')
    expect(isTransientDbError(Object.assign(new Error('x'), { code: 'P2024' }))).toBe(true)
    expect(isTransientDbError(new Error('Timed out fetching a new connection from the connection pool'))).toBe(true)
    expect(isTransientDbError(new Error('canceling statement due to statement timeout'))).toBe(false)
  })
})
