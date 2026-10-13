import { describe, it, expect, vi } from 'vitest'

vi.mock('@prisma/client', () => ({ Prisma: { defineExtension: (x: unknown) => x } }))

import { __internals } from '@/lib/security/token-defaults-extension'
import { isTokenExpired, TOKEN_TTL_DAYS } from '@/lib/security/token-ttl'

const { TOKEN_FIELDS, fill } = __internals

describe('token defaults', () => {
  it('fills an unguessable token when none is supplied', () => {
    const a = fill('Reference', { candidateId: 'c1' }) as { token: string }
    const b = fill('Reference', { candidateId: 'c1' }) as { token: string }
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(a.token).not.toBe(b.token)
  })
  it('keeps a token the caller supplied', () => {
    expect((fill('Reference', { token: 'mine' }) as { token: string }).token).toBe('mine')
  })
  it('fills every row of a createMany', () => {
    const rows = fill('InterviewPanelist', [{ name: 'a' }, { name: 'b' }]) as { scorecardToken: string }[]
    expect(new Set(rows.map((r) => r.scorecardToken)).size).toBe(2)
  })
  it('uses the right column per model and ignores unrelated models', () => {
    expect(TOKEN_FIELDS.Coach).toBe('accessToken')
    expect(TOKEN_FIELDS.EmployerReferenceSubmission).toBe('inviteToken')
    expect(fill('JobPosting', { title: 't' })).toEqual({ title: 't' })
  })
})

describe('isTokenExpired', () => {
  const now = Date.parse('2026-10-13T00:00:00Z')
  const daysAgo = (d: number) => new Date(now - d * 86_400_000)
  it('is false inside the lifetime and true after it', () => {
    expect(isTokenExpired(daysAgo(10), 90, now)).toBe(false)
    expect(isTokenExpired(daysAgo(91), 90, now)).toBe(true)
  })
  it('does not expire when the issue date is unknown', () => {
    expect(isTokenExpired(null, 90, now)).toBe(false)
  })
  it('keeps the documented lifetimes', () => {
    expect(TOKEN_TTL_DAYS).toEqual({ higherEdJoin: 90, scorecard: 120, employerReferenceClaim: 180 })
  })
})
