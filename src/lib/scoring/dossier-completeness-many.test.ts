import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const state = {
    analyses: [] as { candidateId: string; seniorityBand: string; createdAt: number }[],
    references: [] as { candidateId: string; status: string }[],
    profiles: [] as Record<string, unknown>[],
    operating: [] as { candidateId: string }[],
    personality: [] as { candidateId: string }[],
    outreach: [] as { candidateId: string }[],
    postings: [] as { candidateId: string; appliedAt: Date | null }[],
    sprints: [] as { candidateId: string; committedActions: unknown }[],
  }
  const inIds = (where: { candidateId?: { in: string[] } } | undefined, id: string) => !where?.candidateId?.in || where.candidateId.in.includes(id)
  const eq = (where: { candidateId?: string | { in: string[] } }, id: string) =>
    typeof where.candidateId === 'string' ? where.candidateId === id : inIds(where as { candidateId?: { in: string[] } }, id)
  const countBy = (rows: { candidateId: string }[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.candidateId, (m.get(r.candidateId) ?? 0) + 1)
    return [...m].map(([candidateId, n]) => ({ candidateId, _count: { _all: n } }))
  }
  const prisma = {
    resumeAnalysis: {
      findFirst: async ({ where }: { where: { candidateId: string } }) =>
        state.analyses.filter((a) => a.candidateId === where.candidateId).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      findMany: async ({ where }: { where: { candidateId: { in: string[] } } }) =>
        state.analyses.filter((a) => eq(where, a.candidateId)).sort((a, b) => b.createdAt - a.createdAt),
    },
    reference: {
      count: async ({ where }: { where: { candidateId: string; status: string } }) =>
        state.references.filter((r) => r.candidateId === where.candidateId && r.status === where.status).length,
      groupBy: async ({ where }: { where: { candidateId: { in: string[] }; status: string } }) =>
        countBy(state.references.filter((r) => eq(where, r.candidateId) && r.status === where.status)),
    },
    candidateProfile: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const p = state.profiles.find((x) => x.id === where.id)
        if (!p) throw new Error('missing')
        return p
      },
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => state.profiles.filter((p) => where.id.in.includes(p.id as string)),
    },
    candidateAssessmentResponse: assessment('operating'),
    performanceAssessmentResponse: assessment('personality'),
    outreachLog: {
      count: async ({ where }: { where: { candidateId: string } }) => state.outreach.filter((r) => r.candidateId === where.candidateId).length,
      groupBy: async ({ where }: { where: { candidateId: { in: string[] } } }) => countBy(state.outreach.filter((r) => eq(where, r.candidateId))),
    },
    jobPosting: {
      count: async ({ where }: { where: { candidateId: string } }) =>
        state.postings.filter((r) => r.candidateId === where.candidateId && r.appliedAt !== null).length,
      groupBy: async ({ where }: { where: { candidateId: { in: string[] } } }) =>
        countBy(state.postings.filter((r) => eq(where, r.candidateId) && r.appliedAt !== null)),
    },
    weeklySprint: {
      findMany: async ({ where }: { where: { candidateId: string | { in: string[] } } }) => state.sprints.filter((s) => eq(where, s.candidateId)),
    },
  }
  function assessment(key: 'operating' | 'personality') {
    return {
      findFirst: async ({ where }: { where: { candidateId: string } }) => state[key].find((r) => r.candidateId === where.candidateId) ?? null,
      findMany: async ({ where }: { where: { candidateId: { in: string[] } } }) => {
        const seen = new Set<string>()
        return state[key].filter((r) => eq(where, r.candidateId) && !seen.has(r.candidateId) && seen.add(r.candidateId))
      },
    }
  }
  return { state, prisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
vi.mock('@/lib/dashboard/access-gate', () => ({ isGmailConnected: vi.fn() }))
vi.mock('@/lib/dashboard/linkedin-connection', () => ({ isLinkedInConnected: vi.fn() }))
vi.mock('@/lib/scoring/market-reality/effort', () => ({ computeCurrentSprintStreak: vi.fn() }))

import { computeDossierCompleteness, computeDossierCompletenessMany } from './dossier-unlock'

const confirmed = new Date('2026-01-01')
const profile = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  skillsAssessmentCompletedAt: confirmed,
  effortMinutesTargetOverride: null,
  profileConfirmedAt: confirmed,
  industryConfirmedAt: confirmed,
  functionConfirmedAt: confirmed,
  salaryConfirmedAt: confirmed,
  workAuthConfirmedAt: confirmed,
  linkedInConfirmedAt: confirmed,
  ...over,
})
const many = <T,>(n: number, make: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => make(i))

describe('computeDossierCompletenessMany', () => {
  beforeEach(() => {
    const s = db.state
    s.analyses = [
      { candidateId: 'exec', seniorityBand: 'EXECUTIVE', createdAt: 1 },
      { candidateId: 'exec', seniorityBand: 'MID', createdAt: 0 },
      { candidateId: 'old', seniorityBand: 'EXECUTIVE', createdAt: 0 },
      { candidateId: 'old', seniorityBand: 'SENIOR', createdAt: 5 },
    ]
    s.profiles = [
      profile('full'),
      profile('exec'),
      profile('old'),
      profile('empty', { skillsAssessmentCompletedAt: null, profileConfirmedAt: null, effortMinutesTargetOverride: 10 }),
    ]
    s.references = [
      ...many(3, () => ({ candidateId: 'full', status: 'COMPLETED' })),
      { candidateId: 'full', status: 'PENDING' },
      ...many(2, () => ({ candidateId: 'exec', status: 'COMPLETED' })),
    ]
    s.operating = [{ candidateId: 'full' }, { candidateId: 'full' }, { candidateId: 'exec' }] as { candidateId: string }[]
    s.personality = [{ candidateId: 'full' }]
    s.outreach = [...many(20, () => ({ candidateId: 'full' })), ...many(16, () => ({ candidateId: 'exec' }))] as { candidateId: string }[]
    s.postings = [
      ...many(5, () => ({ candidateId: 'full', appliedAt: confirmed })),
      { candidateId: 'full', appliedAt: null },
      ...many(2, () => ({ candidateId: 'exec', appliedAt: confirmed })),
    ] as { candidateId: string; appliedAt: Date | null }[]
    s.sprints = [
      { candidateId: 'full', committedActions: [{ points: 480, completed: true }] },
      { candidateId: 'exec', committedActions: [{ points: 100, completed: true }, { points: 50, completed: false }] },
      { candidateId: 'empty', committedActions: null },
    ]
  })

  it('returns exactly what the per-candidate check returns, for every candidate', async () => {
    const ids = ['full', 'exec', 'old', 'empty']
    const batched = await computeDossierCompletenessMany(ids)
    for (const id of ids) expect(batched.get(id)).toEqual(await computeDossierCompleteness(id))
    expect(batched.get('full')?.isComplete).toBe(true)
    expect(batched.get('exec')?.isComplete).toBe(false)
  })

  it('handles an empty list and de-duplicates ids', async () => {
    expect((await computeDossierCompletenessMany([])).size).toBe(0)
    expect((await computeDossierCompletenessMany(['full', 'full'])).size).toBe(1)
  })
})
