import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../app/.well-known/openai-apps-challenge/route'

describe('OpenAI apps domain challenge', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('returns the token as plain text', async () => {
    vi.stubEnv('OPENAI_APPS_CHALLENGE', ' abc123\n')
    const res = GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    expect(await res.text()).toBe('abc123')
  })
  it('is 404 until a token is set', () => {
    vi.stubEnv('OPENAI_APPS_CHALLENGE', '')
    expect(GET().status).toBe(404)
  })
})
