import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { claimFreshJobAlert, FRESH_ALERT_COOLDOWN_MS, type FreshAlertCapDb, type FreshAlertCapTx } from '@/lib/jobs/fresh-job-alert-cap'

type Row = { candidateId: string; postingId: string; sentAt: Date }

/** In-memory FreshJobAlertSend with transactions run one at a time (what Serializable guarantees). */
function fakeDb(rows: Row[] = []) {
  let chain: Promise<unknown> = Promise.resolve()
  const tx: FreshAlertCapTx = {
    freshJobAlertSend: {
      async findFirst({ where }) {
        return rows.find((r) => r.candidateId === where.candidateId && r.sentAt >= where.sentAt.gte) ?? null
      },
      async findMany({ where }) {
        return rows
          .filter((r) => r.candidateId === where.candidateId && where.postingId.in.includes(r.postingId))
          .map((r) => ({ postingId: r.postingId }))
      },
      async createMany({ data }) {
        for (const d of data) {
          if (!rows.some((r) => r.candidateId === d.candidateId && r.postingId === d.postingId)) rows.push({ ...d })
        }
        return { count: data.length }
      },
    },
  }
  const db: FreshAlertCapDb = {
    $transaction(fn) {
      const run = chain.then(() => fn(tx))
      chain = run.catch(() => undefined)
      return run
    },
  }
  return { db, rows }
}

const NOW = new Date('2026-10-15T16:30:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

describe('fresh-job alert cap', () => {
  it('claims the jobs when the member has had no alert in 24 hours', async () => {
    const { db, rows } = fakeDb([{ candidateId: 'c1', postingId: 'old', sentAt: hoursAgo(30) }])
    const res = await claimFreshJobAlert(db, 'c1', ['p1', 'p2'], NOW)
    expect(res).toEqual({ status: 'claimed', postingIds: ['p1', 'p2'] })
    expect(rows.filter((r) => r.sentAt === NOW).map((r) => r.postingId)).toEqual(['p1', 'p2'])
  })

  it('blocks a second alert within 24 hours, from any run', async () => {
    const { db } = fakeDb([{ candidateId: 'c1', postingId: 'p0', sentAt: hoursAgo(3) }])
    expect(await claimFreshJobAlert(db, 'c1', ['p1'], NOW)).toEqual({ status: 'cooldown' })
    // just inside / just outside the rolling window
    const edge = fakeDb([{ candidateId: 'c1', postingId: 'p0', sentAt: new Date(NOW.getTime() - FRESH_ALERT_COOLDOWN_MS + 1000) }])
    expect((await claimFreshJobAlert(edge.db, 'c1', ['p1'], NOW)).status).toBe('cooldown')
    const after = fakeDb([{ candidateId: 'c1', postingId: 'p0', sentAt: new Date(NOW.getTime() - FRESH_ALERT_COOLDOWN_MS - 1000) }])
    expect((await claimFreshJobAlert(after.db, 'c1', ['p1'], NOW)).status).toBe('claimed')
  })

  it('caps per member, not globally', async () => {
    const { db } = fakeDb([{ candidateId: 'c1', postingId: 'p0', sentAt: hoursAgo(1) }])
    expect((await claimFreshJobAlert(db, 'c2', ['p1'], NOW)).status).toBe('claimed')
  })

  it('never re-sends a posting the member already got', async () => {
    const { db } = fakeDb([{ candidateId: 'c1', postingId: 'p1', sentAt: hoursAgo(48) }])
    expect(await claimFreshJobAlert(db, 'c1', ['p1', 'p2'], NOW)).toEqual({ status: 'claimed', postingIds: ['p2'] })
    const only = fakeDb([{ candidateId: 'c1', postingId: 'p1', sentAt: hoursAgo(48) }])
    expect(await claimFreshJobAlert(only.db, 'c1', ['p1'], NOW)).toEqual({ status: 'nothing_new' })
  })

  it('lets only one of several overlapping runs claim a member', async () => {
    const { db, rows } = fakeDb()
    const results = await Promise.all([
      claimFreshJobAlert(db, 'c1', ['p1'], NOW),
      claimFreshJobAlert(db, 'c1', ['p2'], NOW),
      claimFreshJobAlert(db, 'c1', ['p3'], NOW),
    ])
    expect(results.filter((r) => r.status === 'claimed')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'cooldown')).toHaveLength(2)
    expect(rows).toHaveLength(1)
  })

  it('treats a serialization conflict (P2034) as already alerted, and rethrows other errors', async () => {
    const conflict: FreshAlertCapDb = { $transaction: async () => { throw Object.assign(new Error('conflict'), { code: 'P2034' }) } }
    expect(await claimFreshJobAlert(conflict, 'c1', ['p1'], NOW)).toEqual({ status: 'cooldown' })
    const broken: FreshAlertCapDb = { $transaction: async () => { throw new Error('db down') } }
    await expect(claimFreshJobAlert(broken, 'c1', ['p1'], NOW)).rejects.toThrow('db down')
  })

  it('uses a Serializable transaction and keeps the existing email guards', async () => {
    let seen: unknown
    const spy: FreshAlertCapDb = { $transaction: async (_fn, opts) => { seen = opts.isolationLevel; return { status: 'cooldown' } as never } }
    await claimFreshJobAlert(spy, 'c1', ['p1'], NOW)
    expect(seen).toBe('Serializable')
    const src = readFileSync('src/lib/jobs/fresh-job-alerts.ts', 'utf8')
    expect(src).toContain('claimFreshJobAlert(prisma')
    expect(src).toContain('emailFitScoringVersion()')
    expect(src).toContain('includeMidLevel: midLevelInEmails()')
    expect(src).toContain('emailSafeJobs(')
    expect(src).toContain('MAX_JOBS = 2')
  })

  // Retired as a default (2026-10-19): Job Search Daily already carries a
  // "Posted in the last 72 hours" section, so a separate alert email doubled
  // the strong-fit job pushes. The route stays for an explicit opt-in later;
  // re-add the cron to vercel.json only together with that preference.
  it('is not scheduled by default', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons as { path: string }[]
    expect(crons.some((c) => c.path === '/api/cron/fresh-job-alerts')).toBe(false)
  })
})

describe('fresh-job alerts: full-time only', () => {
  it('reads contract, fractional and board titles as non-full-time', async () => {
    const { classifyWorkType } = await import('@/lib/jobs/work-type')
    expect(classifyWorkType({ title: 'Interim CFO' })).not.toBe('full_time')
    expect(classifyWorkType({ title: 'Fractional CMO' })).not.toBe('full_time')
    expect(classifyWorkType({ title: 'Board Member' })).not.toBe('full_time')
    expect(classifyWorkType({ title: 'VP Finance', employmentType: 'contract' })).not.toBe('full_time')
    expect(classifyWorkType({ title: 'VP Finance' })).toBe('full_time')
  })
})
