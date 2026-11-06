import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const run = vi.fn()
vi.mock('@/lib/resume/post-upload-analysis', () => ({ runPostUploadAnalysis: (...args: unknown[]) => run(...args) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

import { dispatchPostUploadAnalysis } from '@/lib/resume/post-analysis-dispatch'

const previous = { atsScore: 70, resultsScore: 60, experienceScore: 50 }

describe('dispatchPostUploadAnalysis', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    run.mockReset().mockResolvedValue(undefined)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CRON_SECRET', 'a-secret-that-is-long-enough')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('hands the analysis to its own invocation and does not run it here when the call is accepted', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }))
    await dispatchPostUploadAnalysis('p1', 'r1', previous)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/internal/resume-analysis')
    expect(init.headers.Authorization).toBe('Bearer a-secret-that-is-long-enough')
    expect(JSON.parse(init.body)).toEqual({ profileId: 'p1', resumeId: 'r1', previous })
    expect(run).not.toHaveBeenCalled()
  })

  it('runs it here when there is no secret, so the admin notice, CRM mirror and grade are never lost', async () => {
    vi.stubEnv('CRON_SECRET', '')
    await dispatchPostUploadAnalysis('p1', 'r1', previous)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledWith('p1', 'r1', previous)
  })

  it('runs it here when the other invocation refuses (a preview deployment, a wrong secret)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    await dispatchPostUploadAnalysis('p1', 'r1', previous)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('runs it here when the call fails or times out', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await dispatchPostUploadAnalysis('p1', 'r1', null)
    expect(run).toHaveBeenCalledWith('p1', 'r1', null)
  })
})
