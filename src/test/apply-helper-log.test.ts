import { describe, it, expect, vi, beforeEach } from 'vitest'

const changeStatus = vi.fn()
vi.mock('@/lib/jobs/change-status', () => ({ changeStatus: (...a: unknown[]) => changeStatus(...a) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { logExtensionApplication } from '@/lib/apply-helper/log-application'

describe('apply helper: logging an application to My jobs', () => {
  beforeEach(() => changeStatus.mockReset().mockResolvedValue({ ok: true }))

  it('logs a supported posting as applied, as an external job', async () => {
    const r = await logExtensionApplication('cand1', { url: 'https://jobs.lever.co/acme/abc', title: ' CFO ', company: 'Acme', site: 'lever' })
    expect(r).toEqual({ ok: true })
    const [id, ref, status, source] = changeStatus.mock.calls[0]
    expect(id).toBe('cand1')
    expect(ref).toMatchObject({ source: 'external', title: 'CFO', companyName: 'Acme', url: 'https://jobs.lever.co/acme/abc' })
    expect(status).toBe('applied')
    expect(source).toBe('apply_helper')
  })

  it('uses the same row for the same posting', async () => {
    const input = { url: 'https://jobs.lever.co/acme/abc', title: 'CFO', company: '', site: 'lever' }
    await logExtensionApplication('cand1', input)
    await logExtensionApplication('cand1', input)
    expect(changeStatus.mock.calls[0][1].sourceId).toBe(changeStatus.mock.calls[1][1].sourceId)
    expect(changeStatus.mock.calls[0][1].companyName).toBeNull()
  })

  it('refuses other sites, plain http and empty titles without touching My jobs', async () => {
    for (const bad of [
      { url: 'https://evil.com/x', title: 'CFO' },
      { url: 'http://jobs.lever.co/a/b', title: 'CFO' },
      { url: 'https://jobs.lever.co/a/b', title: '  ' },
      { url: 'not a url', title: 'CFO' },
    ]) {
      expect(await logExtensionApplication('cand1', { ...bad, company: '', site: 'lever' })).toEqual({ ok: false, error: 'bad_request' })
    }
    expect(changeStatus).not.toHaveBeenCalled()
  })

  it('reports a failed save', async () => {
    changeStatus.mockResolvedValue({ ok: false, error: 'x' })
    expect(await logExtensionApplication('cand1', { url: 'https://jobs.lever.co/a/b', title: 'CFO', company: '', site: 'lever' })).toEqual({ ok: false, error: 'failed' })
  })
})
