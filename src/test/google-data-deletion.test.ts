import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const calls: { op: string; args: unknown }[] = []
const rec = (op: string, ret: unknown = { count: 0 }) => vi.fn(async (args?: unknown) => { calls.push({ op, args }); return ret })

const state = {
  email: [] as Record<string, unknown>[],
  calendar: null as Record<string, unknown> | null,
}

const prismaMock = {
  emailConnection: {
    findMany: vi.fn(async () => state.email),
    updateMany: rec('emailConnection.updateMany'),
    deleteMany: rec('emailConnection.deleteMany', { count: 1 }),
  },
  calendarConnection: {
    findUnique: vi.fn(async () => state.calendar),
    updateMany: rec('calendarConnection.updateMany'),
    deleteMany: rec('calendarConnection.deleteMany', { count: 1 }),
  },
  trackedEmailActivity: { deleteMany: rec('trackedEmailActivity.deleteMany', { count: 12 }) },
  trackedCalendarEvent: { deleteMany: rec('trackedCalendarEvent.deleteMany', { count: 3 }) },
  scamAlert: { deleteMany: rec('scamAlert.deleteMany', { count: 1 }) },
  candidatePlatformEvent: { deleteMany: rec('candidatePlatformEvent.deleteMany', { count: 4 }) },
  classificationFeedback: { deleteMany: rec('classificationFeedback.deleteMany'), updateMany: rec('classificationFeedback.updateMany') },
  candidatePlatformActivity: { updateMany: rec('candidatePlatformActivity.updateMany') },
  jobPosting: { deleteMany: rec('jobPosting.deleteMany'), updateMany: rec('jobPosting.updateMany') },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/email-tracking/gmail-push', () => ({ stopGmailWatch: vi.fn(async () => {}) }))

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  calls.length = 0
  fetchMock.mockClear()
  state.email = []
  state.calendar = null
})

describe('disconnect deletes stored Google tokens', () => {
  it('revokes once both are disconnected, then blanks tokens on disconnected rows only', async () => {
    const { revokeGoogleGrantIfFullyDisconnected } = await import('@/lib/google/candidate-revoke')
    state.email = [{ refreshToken: 'r1', accessToken: 'a1', disconnectedAt: new Date() }]
    state.calendar = { refreshToken: 'r1', accessToken: 'a2', disconnectedAt: new Date() }
    expect(await revokeGoogleGrantIfFullyDisconnected('c1')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1) // same refresh token on both rows: revoked once
    const clears = calls.filter((c) => c.op.endsWith('Connection.updateMany'))
    expect(clears).toHaveLength(2)
    for (const c of clears) {
      expect(c.args).toEqual({ where: { candidateId: 'c1', disconnectedAt: { not: null } }, data: { accessToken: '', refreshToken: '' } })
    }
  })

  it('does not revoke while Calendar is still connected, but still clears the disconnected Gmail row', async () => {
    const { revokeGoogleGrantIfFullyDisconnected } = await import('@/lib/google/candidate-revoke')
    state.email = [{ refreshToken: 'r1', accessToken: 'a1', disconnectedAt: new Date() }]
    state.calendar = { refreshToken: 'r1', accessToken: 'a2', disconnectedAt: null }
    expect(await revokeGoogleGrantIfFullyDisconnected('c1')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls.filter((c) => c.op.endsWith('Connection.updateMany'))).toHaveLength(2)
  })
})

describe('deleteGoogleDataForCandidate', () => {
  it('revokes, deletes raw Google records and connections, keeps applications', async () => {
    const { deleteGoogleDataForCandidate } = await import('@/lib/google/delete-google-data')
    state.email = [{ id: 'e1', refreshToken: 'r1', accessToken: 'a1', disconnectedAt: null }]
    state.calendar = { id: 'k1', refreshToken: 'r1', accessToken: 'a2', disconnectedAt: null }

    const result = await deleteGoogleDataForCandidate('c1')

    expect(result).toEqual({ emails: 12, calendarEvents: 3, scamAlerts: 1, platformEmails: 4, connections: 2, grantRevoked: true, hadTokens: true })
    const ops = calls.map((c) => c.op)
    // Sync stopped before revoke, revoke before rows are deleted.
    expect(ops.indexOf('emailConnection.updateMany')).toBeLessThan(ops.indexOf('emailConnection.deleteMany'))
    for (const op of ['trackedEmailActivity.deleteMany', 'trackedCalendarEvent.deleteMany', 'scamAlert.deleteMany', 'candidatePlatformEvent.deleteMany', 'emailConnection.deleteMany', 'calendarConnection.deleteMany', 'candidatePlatformActivity.updateMany']) {
      expect(ops).toContain(op)
    }
    expect(calls.find((c) => c.op === 'classificationFeedback.deleteMany')?.args).toEqual({ where: { candidateId: 'c1', recordKind: 'EMAIL_ACTIVITY' } })
    // Applications are the member's own records: never touched.
    expect(ops.some((op) => op.startsWith('jobPosting.'))).toBe(false)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('reports nothing to revoke when no tokens are stored', async () => {
    const { deleteGoogleDataForCandidate } = await import('@/lib/google/delete-google-data')
    state.email = [{ id: 'e1', refreshToken: '', accessToken: '', disconnectedAt: new Date() }]
    const result = await deleteGoogleDataForCandidate('c1')
    expect(result.hadTokens).toBe(false)
    expect(result.grantRevoked).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('token encryption leaves a deleted (empty) token empty', () => {
  it('does not encrypt an empty string', async () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    const { encryptToken } = await import('@/lib/security/token-crypto')
    expect(encryptToken('')).toBe('')
  })
})
