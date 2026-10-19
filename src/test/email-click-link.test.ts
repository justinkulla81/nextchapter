import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildEmailClickUrl, readEmailClickUrl } from '@/lib/email/click-link'

const APP = 'https://app.example.com'

afterEach(() => vi.unstubAllEnvs())

describe('email click links', () => {
  it('round-trips a signed link', () => {
    vi.stubEnv('CRON_SECRET', 'secret')
    const built = buildEmailClickUrl(APP, 'cand1', 'FINISH_LINE', `${APP}/dashboard`)
    expect(built.startsWith(`${APP}/api/e/go?`)).toBe(true)
    expect(readEmailClickUrl(new URL(built).searchParams)).toEqual({
      candidateId: 'cand1',
      emailKey: 'FINISH_LINE',
      url: `${APP}/dashboard`,
    })
  })

  it('rejects a tampered destination, key, or candidate', () => {
    vi.stubEnv('CRON_SECRET', 'secret')
    const u = new URL(buildEmailClickUrl(APP, 'cand1', 'FINISH_LINE', `${APP}/dashboard`))
    const evil = Buffer.from('https://evil.example/', 'utf8').toString('base64url')
    for (const [k, v] of [['u', evil], ['k', 'MARKET_UPDATE'], ['c', 'cand2']] as const) {
      const p = new URLSearchParams(u.searchParams)
      p.set(k, v)
      expect(readEmailClickUrl(p)).toBeNull()
    }
  })

  it('rejects a link signed with a different secret', () => {
    vi.stubEnv('CRON_SECRET', 'secret')
    const built = buildEmailClickUrl(APP, 'cand1', 'FINISH_LINE', `${APP}/dashboard`)
    vi.stubEnv('CRON_SECRET', 'other')
    expect(readEmailClickUrl(new URL(built).searchParams)).toBeNull()
  })

  it('rejects non-http destinations even when signed', () => {
    vi.stubEnv('CRON_SECRET', 'secret')
    const built = buildEmailClickUrl(APP, 'cand1', 'FINISH_LINE', 'javascript:alert(1)')
    expect(readEmailClickUrl(new URL(built).searchParams)).toBeNull()
  })

  it('falls back to the plain URL when no secret is configured, so a send is never blocked', () => {
    vi.stubEnv('CRON_SECRET', '')
    expect(buildEmailClickUrl(APP, 'cand1', 'FINISH_LINE', `${APP}/dashboard`)).toBe(`${APP}/dashboard`)
  })
})
