import { beforeEach, describe, expect, it, vi } from 'vitest'

const run = vi.fn()
vi.mock('@/lib/resume/post-upload-analysis', () => ({ runPostUploadAnalysis: (...args: unknown[]) => run(...args) }))
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

import { POST } from '@/app/api/internal/resume-analysis/route'

const SECRET = 'a-secret-that-is-long-enough'
const call = (body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  POST(new Request('http://localhost/api/internal/resume-analysis', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) }) as never)

describe('POST /api/internal/resume-analysis', () => {
  beforeEach(() => {
    run.mockReset().mockResolvedValue(undefined)
    vi.stubEnv('CRON_SECRET', SECRET)
  })

  it('refuses a request without the secret, and a wrong one', async () => {
    expect((await call({ profileId: 'p', resumeId: 'r' }, null)).status).toBe(401)
    expect((await call({ profileId: 'p', resumeId: 'r' }, 'Bearer nope')).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('refuses a body without both ids', async () => {
    expect((await call({ profileId: 'p' })).status).toBe(400)
    expect((await call('not json')).status).toBe(400)
    expect(run).not.toHaveBeenCalled()
  })

  it('answers 202 and runs the analysis with the previous scores', async () => {
    const res = await call({ profileId: 'p', resumeId: 'r', previous: { atsScore: 1, resultsScore: null, experienceScore: 3 } })
    expect(res.status).toBe(202)
    expect(run).toHaveBeenCalledWith('p', 'r', { atsScore: 1, resultsScore: null, experienceScore: 3 })
  })
})
