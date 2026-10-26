import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// CASA prep (2026-10-21): open redirect via "/\host", Secure on session
// cookies, and the security headers next.config.ts sends on every page.

const findUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { referralLink: { findUnique: (...a: unknown[]) => findUnique(...a), update: vi.fn(async () => ({})) } },
}))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

const signOut = vi.fn(async () => ({}))
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`)
})
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signOut } }) }))

async function referral(to: string | null, code = 'abc123') {
  const { GET } = await import('@/app/api/r/[code]/route')
  const url = new URL(`https://launchyournextchapter.com/api/r/${code}`)
  if (to !== null) url.searchParams.set('to', to)
  return GET(new NextRequest(url), { params: Promise.resolve({ code }) })
}

describe('referral link /api/r/[code] ?to=', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://launchyournextchapter.com')
    findUnique.mockResolvedValue(null)
  })

  it('keeps an on-site path', async () => {
    const res = await referral('/pricing?utm_source=x')
    expect(res.headers.get('location')).toBe('https://launchyournextchapter.com/pricing?utm_source=x')
  })

  it.each(['/\\evil.example', '//evil.example', 'https://evil.example', '/\\/evil.example', '\\\\evil.example'])(
    'never leaves the site for %s',
    async (to) => {
      const res = await referral(to)
      expect(new URL(res.headers.get('location')!).host).toBe('launchyournextchapter.com')
    },
  )

  it('sets the referral cookie Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    findUnique.mockResolvedValue({ id: 'l1', isActive: true, label: null })
    const res = await referral('/')
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    vi.unstubAllEnvs()
  })
})

describe('signOutOrg next', () => {
  it.each([
    ['/i/acme/hub', '/i/acme/hub'],
    ['/\\evil.example', '/'],
    ['//evil.example', '/'],
  ])('%s -> %s', async (next, expected) => {
    const { signOutOrg } = await import('@/app/i/[slug]/(portal)/session-actions')
    await expect(signOutOrg(next)).rejects.toThrow(`REDIRECT ${expected}`)
    expect(signOut).toHaveBeenCalled()
  })
})

describe('sessionCookieOptions', () => {
  it('always carries secure, and a name only for portal cookies', async () => {
    const { sessionCookieOptions } = await import('@/lib/supabase/cookie-options')
    expect(sessionCookieOptions(undefined, true)).toEqual({ secure: true })
    expect(sessionCookieOptions('sb-admin-auth-token', true)).toEqual({ name: 'sb-admin-auth-token', secure: true })
    expect(sessionCookieOptions(undefined, false)).toEqual({ secure: false })
  })
})

describe('security headers (next.config.ts)', () => {
  it('sends HSTS, CSP, frame, referrer and permissions headers on every path', async () => {
    const { default: config } = await import('../../next.config')
    const rules = await config.headers!()
    // Every path except /embed/*, which is built to be framed by other sites (next.config.ts).
    const all = rules.find((r) => r.source === '/:path((?!embed/).*)')!
    const h = Object.fromEntries(all.headers.map((x) => [x.key.toLowerCase(), x.value]))
    expect(h['strict-transport-security']).toMatch(/max-age=\d{8,}; includeSubDomains/)
    expect(h['content-security-policy']).toContain("frame-ancestors 'self'")
    expect(h['content-security-policy']).toContain("object-src 'none'")
    expect(h['x-frame-options']).toBe('SAMEORIGIN')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy']).toContain('camera=()')
  })
  it('lets other sites frame only /embed/*, and keeps every other protection there', async () => {
    const { default: config } = await import('../../next.config')
    const rules = await config.headers!()
    const embed = rules.find((r) => r.source === '/embed/:path*')!
    const h = Object.fromEntries(embed.headers.map((x) => [x.key.toLowerCase(), x.value]))
    expect(h['content-security-policy']).toContain('frame-ancestors *')
    expect(h['content-security-policy']).toContain("object-src 'none'")
    expect(h['x-frame-options']).toBeUndefined()
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['strict-transport-security']).toBeDefined()
  })
})
