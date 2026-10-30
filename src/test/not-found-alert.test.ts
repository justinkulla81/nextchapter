import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const send = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/email/resend-client', () => ({ createResend: () => ({ emails: { send } }) }))
const allow = vi.fn(async (_opts: unknown) => true)
vi.mock('@/lib/security/rate-limit', () => ({ allowRequest: (a: unknown) => allow(a), DAY_MS: 86400000 }))

import { alertNotFound, cleanPath, PROBE } from '@/lib/not-found/alert'

describe('404 alert', () => {
  it('keeps only a plain site path', () => {
    expect(cleanPath('/jobs/old?x=1')).toBe('/jobs/old')
    expect(cleanPath('//evil.com')).toBeNull()
    expect(cleanPath('/a<script>')).toBeNull()
    expect(cleanPath('https://x.com')).toBeNull()
  })
  it('ignores scanner probes', () => {
    for (const p of ['/wp-login.php', '/.env', '/phpmyadmin/', '/xmlrpc.php']) expect(PROBE.test(p)).toBe(true)
    expect(PROBE.test('/jobs/old-listing')).toBe(false)
  })
  it('emails once for a real missing page on our hosts', async () => {
    process.env.RESEND_API_KEY = 'k'
    expect(await alertNotFound({ path: '/jobs/old-listing', host: 'launchyournextchapter.com', referrer: '' }, 0)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('does not email for other hosts, probes, or when over the cap', async () => {
    send.mockClear()
    expect(await alertNotFound({ path: '/x', host: 'evil.com', referrer: '' })).toBe(false)
    expect(await alertNotFound({ path: '/wp-login.php', host: 'launchyournextchapter.com', referrer: '' })).toBe(false)
    allow.mockResolvedValueOnce(false)
    expect(await alertNotFound({ path: '/y', host: 'launchyournextchapter.com', referrer: '' })).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
  it('stays quiet when the page is live again after the deploy window, and emails when it is still missing', async () => {
    process.env.RESEND_API_KEY = 'k'
    send.mockClear()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }))
    expect(await alertNotFound({ path: '/support/admin/new-page', host: 'admin.launchyournextchapter.com', referrer: '' }, 1)).toBe(false)
    expect(send).not.toHaveBeenCalled()
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }))
    expect(await alertNotFound({ path: '/jobs/gone', host: 'launchyournextchapter.com', referrer: '' }, 1)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
  })
})
