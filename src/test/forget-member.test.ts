import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }))

describe('forgetMemberCookies', () => {
  beforeEach(() => {
    set.mockClear()
    process.env.NEXT_PUBLIC_APP_URL = 'https://launchyournextchapter.com'
  })

  it('expires the marker and the first-name cookie on the site-wide domain and path they were set with', async () => {
    const { forgetMemberCookies } = await import('@/lib/auth/forget-member')
    await forgetMemberCookies()
    expect(set.mock.calls.map((c) => c[0])).toEqual(['nc_member', 'nc_member_name'])
    for (const [, value, options] of set.mock.calls) {
      expect(value).toBe('')
      expect(options).toMatchObject({ domain: 'launchyournextchapter.com', path: '/', maxAge: 0, httpOnly: true })
      expect(options.expires.getTime()).toBe(0)
    }
  })
})
