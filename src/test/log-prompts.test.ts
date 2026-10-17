import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.LINK_SIGNING_SECRET = 'test-secret-for-log-prompts'

// In-memory stand-ins for the two tables the Candidate+ gate counts.
type Outreach = { candidateId: string; noteKey?: string | null; loggedAt: Date; selfReportKey?: string | null; logSource?: string | null }
type Application = { candidateId: string; appliedAt: Date; selfReportKey?: string | null }
const db = { outreach: [] as Outreach[], applications: [] as Application[] }

function createManyUnique<T extends { candidateId: string; selfReportKey?: string | null }>(rows: T[], data: T[]) {
  let count = 0
  for (const r of data) {
    if (rows.some((x) => x.candidateId === r.candidateId && x.selfReportKey && x.selfReportKey === r.selfReportKey)) continue
    rows.push(r)
    count++
  }
  return { count }
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    exclusiveJobPosting: { findUnique: vi.fn(async () => ({ id: 'job1', companyName: 'Acme', recruiterName: 'Pat Lee' })) },
    supportNetworkContact: { findFirst: vi.fn(async () => null) },
    outreachLog: {
      findFirst: vi.fn(async ({ where }: { where: { candidateId: string; noteKey: string; loggedAt: { gte: Date } } }) => {
        const hits = db.outreach.filter((o) => o.candidateId === where.candidateId && o.noteKey === where.noteKey && o.loggedAt >= where.loggedAt.gte)
        return hits.sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())[0] ?? null
      }),
      create: vi.fn(async ({ data }: { data: Outreach }) => {
        db.outreach.push(data)
        return data
      }),
      count: vi.fn(async ({ where }: { where: { candidateId: string; selfReportKey: null; loggedAt: { gte: Date; lte: Date } } }) =>
        db.outreach.filter((o) => o.candidateId === where.candidateId && !o.selfReportKey && o.loggedAt >= where.loggedAt.gte && o.loggedAt <= where.loggedAt.lte).length
      ),
      createMany: vi.fn(async ({ data }: { data: Outreach[] }) => createManyUnique(db.outreach, data)),
    },
    jobPosting: {
      count: vi.fn(async ({ where }: { where: { candidateId: string; appliedAt: { gte: Date; lte: Date } } }) =>
        db.applications.filter((a) => a.candidateId === where.candidateId && !a.selfReportKey && a.appliedAt >= where.appliedAt.gte && a.appliedAt <= where.appliedAt.lte).length
      ),
      createMany: vi.fn(async ({ data }: { data: Application[] }) => createManyUnique(db.applications, data)),
    },
  },
}))
vi.mock('@/lib/scoring/dossier-unlock', () => ({ isDossierUnlocked: vi.fn() }))

const { candidatePlusProgressLine } = await import('@/lib/activity-log/progress')
const { outreachNoteKey, isDuplicateOutreach } = await import('@/lib/activity-log/outreach-note')
const { bucketLow, entriesToLog, selfReportKeys, checkInQuery, readCheckIn, CHECKIN_LINK_TTL_MS } = await import('@/lib/activity-log/weekly-checkin')
const { logOutreachSent, logWeeklyCheckIn } = await import('@/lib/activity-log/log')

const now = new Date('2026-10-19T12:00:00Z')

beforeEach(() => {
  db.outreach = []
  db.applications = []
})

describe('Candidate+ progress line', () => {
  it('counts down to the gate target', () => {
    expect(candidatePlusProgressLine('applications', 2, false)).toBe('2 of 5 applications — 3 to go for Candidate+.')
    expect(candidatePlusProgressLine('outreach', 1, false)).toBe('1 of 5 outreach messages — 4 to go for Candidate+.')
    expect(candidatePlusProgressLine('applications', 7, false)).toBe('5 of 5 applications — done for Candidate+.')
    expect(candidatePlusProgressLine('outreach', 1, true)).toBe('Candidate+ is on. 1 outreach message logged.')
  })
})

describe('"Did you send it?" de-duplication', () => {
  it('treats whitespace and case changes as the same note, but not another job', () => {
    expect(outreachNoteKey('job:1', 'Hi Pat,\n\nI saw the role')).toBe(outreachNoteKey('job:1', '  hi pat, i saw   the ROLE '))
    expect(outreachNoteKey('job:1', 'Hi Pat')).not.toBe(outreachNoteKey('job:2', 'Hi Pat'))
  })
  it('blocks a second log within 24 hours only', () => {
    expect(isDuplicateOutreach(null, now)).toBe(false)
    expect(isDuplicateOutreach(new Date(now.getTime() - 23 * 3600_000), now)).toBe(true)
    expect(isDuplicateOutreach(new Date(now.getTime() - 25 * 3600_000), now)).toBe(false)
  })
  it('logs one OutreachLog row per note per 24h, with company and contact kind', async () => {
    const input = { source: 'who_to_contact' as const, note: 'Hi Pat, I applied for the Director role.', jobId: 'job1' }
    const first = await logOutreachSent('c1', input, now)
    expect(first).toMatchObject({ logged: true, companyName: 'Acme', contactKind: 'posting_contact' })
    const again = await logOutreachSent('c1', input, new Date(now.getTime() + 3600_000))
    expect(again).toMatchObject({ logged: false, duplicate: true })
    expect(db.outreach).toHaveLength(1)
    expect(db.outreach[0]).toMatchObject({ candidateId: 'c1', logSource: 'who_to_contact', companyName: 'Acme', jobId: 'job1' })
    const nextDay = await logOutreachSent('c1', input, new Date(now.getTime() + 25 * 3600_000))
    expect(nextDay.logged).toBe(true)
    expect(db.outreach).toHaveLength(2)
  })
})

describe('weekly check-in', () => {
  it('logs the low end of each range, at most 6', () => {
    expect(['0', '1-2', '3-5', '6+'].map((b) => bucketLow(b as '0'))).toEqual([0, 1, 3, 6])
    expect(entriesToLog(3, 0)).toBe(3)
    expect(entriesToLog(3, 2)).toBe(1)
    expect(entriesToLog(3, 5)).toBe(0)
    expect(entriesToLog(9, 0)).toBe(6)
    expect(selfReportKeys('2026-10-19', 'applications', 2)).toEqual(['weekly_checkin:2026-10-19:applications:1', 'weekly_checkin:2026-10-19:applications:2'])
  })

  const payload = { candidateId: 'c1', kind: 'applications' as const, bucket: '3-5' as const, weekKey: '2026-10-19', issuedAt: now.getTime() }
  const params = (q: string) => Object.fromEntries(new URLSearchParams(q))

  it('accepts a signed link and rejects a tampered one', () => {
    const q = checkInQuery(payload)
    expect(readCheckIn(params(q), now)).toEqual({ ok: true, payload })
    expect(readCheckIn(params(q.replace('b=3-5', 'b=6%2B')), now)).toEqual({ ok: false, reason: 'invalid' })
    expect(readCheckIn(params(q.replace('c=c1', 'c=c2')), now)).toEqual({ ok: false, reason: 'invalid' })
    expect(readCheckIn({}, now)).toEqual({ ok: false, reason: 'invalid' })
  })
  it('expires after 14 days', () => {
    const q = checkInQuery(payload)
    expect(readCheckIn(params(q), new Date(now.getTime() + CHECKIN_LINK_TTL_MS - 1000)).ok).toBe(true)
    expect(readCheckIn(params(q), new Date(now.getTime() + CHECKIN_LINK_TTL_MS + 1000))).toEqual({ ok: false, reason: 'expired' })
  })
  it('is idempotent per week: tapping twice never double-logs', async () => {
    const first = await logWeeklyCheckIn(payload, now)
    expect(first).toEqual({ reported: 3, alreadyLogged: 0, added: 3 })
    const second = await logWeeklyCheckIn(payload, new Date(now.getTime() + 60_000))
    expect(second.added).toBe(0)
    expect(db.applications).toHaveLength(3)
    // A higher range later that week adds only the difference; a lower one adds nothing.
    expect((await logWeeklyCheckIn({ ...payload, bucket: '6+' }, now)).added).toBe(3)
    expect((await logWeeklyCheckIn({ ...payload, bucket: '1-2' }, now)).added).toBe(0)
    expect(db.applications).toHaveLength(6)
    // Next week is a fresh week.
    expect((await logWeeklyCheckIn({ ...payload, bucket: '1-2', weekKey: '2026-10-26' }, now)).added).toBe(1)
  })
  it('does not double-count what Gmail or the board already logged that week', async () => {
    db.applications.push({ candidateId: 'c1', appliedAt: new Date(now.getTime() - 2 * 86_400_000) })
    db.applications.push({ candidateId: 'c1', appliedAt: new Date(now.getTime() - 3 * 86_400_000) })
    db.applications.push({ candidateId: 'c1', appliedAt: new Date(now.getTime() - 30 * 86_400_000) }) // older: not this week
    expect(await logWeeklyCheckIn(payload, now)).toEqual({ reported: 3, alreadyLogged: 2, added: 1 })
  })
  it('logs outreach as self-reported OutreachLog rows', async () => {
    const r = await logWeeklyCheckIn({ ...payload, kind: 'outreach', bucket: '1-2' }, now)
    expect(r.added).toBe(1)
    expect(db.outreach[0]).toMatchObject({ logSource: 'weekly_checkin', selfReportKey: 'weekly_checkin:2026-10-19:outreach:1' })
  })
})
