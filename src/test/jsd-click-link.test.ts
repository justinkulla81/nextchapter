import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildClickUrl, readClickUrl, wrapHrefs } from '@/lib/job-search-daily/click-link'

beforeAll(() => {
  process.env.CRON_SECRET = 'test-secret'
})

describe('job search daily click links', () => {
  const app = 'https://example.com'
  const target = 'https://jobs.example.org/role?id=7'

  it('round-trips a signed link', () => {
    const link = new URL(buildClickUrl(app, 'send1', target))
    expect(readClickUrl(link.searchParams)).toEqual({ sendId: 'send1', url: target })
  })

  it('rejects a tampered target or send id', () => {
    const link = new URL(buildClickUrl(app, 'send1', target))
    const swapped = new URLSearchParams(link.searchParams)
    swapped.set('u', Buffer.from('https://evil.example').toString('base64url'))
    expect(readClickUrl(swapped)).toBeNull()
    const other = new URLSearchParams(link.searchParams)
    other.set('s', 'send2')
    expect(readClickUrl(other)).toBeNull()
  })

  it('wraps only http(s) href fields, deeply', () => {
    const out = wrapHrefs({ a: { href: 'https://x.test/1', title: 't' }, list: [{ href: 'mailto:a@b.c' }, { href: 'https://x.test/2' }] }, (u) => `W(${u})`)
    expect(out).toEqual({ a: { href: 'W(https://x.test/1)', title: 't' }, list: [{ href: 'mailto:a@b.c' }, { href: 'W(https://x.test/2)' }] })
  })
})
