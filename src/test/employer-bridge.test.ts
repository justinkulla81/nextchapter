import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
process.env.NEXT_PUBLIC_APP_URL = 'https://launchyournextchapter.com'

const peek = vi.fn()
const access = vi.fn()
const generateLink = vi.fn()
const capture = vi.fn()
vi.mock('@/lib/supabase/peek-session', () => ({ peekPortalUser: (p: string) => peek(p) }))
vi.mock('@/lib/employer/access', () => ({ getEmployerAccess: (i: unknown) => access(i) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { generateLink: (a: unknown) => generateLink(a) } } }) }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
const linkedIdentity = vi.fn()
vi.mock('@/lib/employer/account-link-server', () => ({ linkedIdentityFor: (...a: unknown[]) => linkedIdentity(...a) }))

import { ARRIVAL_TTL_SECONDS, CSRF_TTL_SECONDS, issueArrival, issueCsrf, parseBridgeTarget, sameOrigin, verifyArrival, verifyCsrf } from '@/lib/employer/section-bridge'
import { POST } from '@/app/api/employer/section-switch/route'

const ORIGIN = 'https://launchyournextchapter.com'

function req(fields: Record<string, string>, headers: Record<string, string> = { origin: ORIGIN }) {
  const body = new URLSearchParams(fields)
  return new Request(`${ORIGIN}/api/employer/section-switch`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers } })
}
// NextRequest adds nextUrl; the handler only needs headers, formData and nextUrl.origin.
const asNext = (r: Request) => Object.assign(r, { nextUrl: new URL(r.url) }) as never

describe('bridge tokens', () => {
  it('a CSRF token only verifies for the user it was issued to, and expires', () => {
    const t = issueCsrf('user-1', 1_000_000)!
    expect(verifyCsrf('user-1', t, 1_000_000 + 1000)).toBe(true)
    expect(verifyCsrf('user-2', t, 1_000_000 + 1000)).toBe(false)
    expect(verifyCsrf('user-1', t, 1_000_000 + (CSRF_TTL_SECONDS + 5) * 1000)).toBe(false)
    expect(verifyCsrf('user-1', t.slice(0, -2) + 'xx', 1_000_000)).toBe(false)
    expect(verifyCsrf('user-1', null)).toBe(false)
    expect(verifyCsrf('user-1', 'garbage')).toBe(false)
  })

  it('an arrival token is bound to the user and the target section, and is short lived', () => {
    const t = issueArrival('u', 'hiring', 5_000_000)!
    expect(verifyArrival('u', 'hiring', t, 5_000_000 + 1000)).toBe('ok')
    expect(verifyArrival('u', 'outplacement', t, 5_000_000 + 1000)).toBe('invalid')
    expect(verifyArrival('other', 'hiring', t, 5_000_000 + 1000)).toBe('invalid')
    expect(verifyArrival('u', 'hiring', t, 5_000_000 + (ARRIVAL_TTL_SECONDS + 5) * 1000)).toBe('expired')
    expect(verifyArrival('u', 'hiring', undefined)).toBe('invalid')
  })

  it('a CSRF token cannot be used as an arrival token', () => {
    const t = issueCsrf('u')!
    expect(verifyArrival('u', 'hiring', t)).toBe('invalid')
  })

  it('only allow-listed section keys are targets', () => {
    expect(parseBridgeTarget('hiring')).toBe('hiring')
    expect(parseBridgeTarget('https://evil.example')).toBeNull()
    expect(parseBridgeTarget('/talent/dashboard')).toBeNull()
    expect(parseBridgeTarget(null)).toBeNull()
  })

  it('requires an Origin or Referer from one of our origins', () => {
    expect(sameOrigin(ORIGIN, null, [ORIGIN])).toBe(true)
    expect(sameOrigin(null, `${ORIGIN}/talent/roles`, [ORIGIN])).toBe(true)
    expect(sameOrigin('https://evil.example', null, [ORIGIN])).toBe(false)
    expect(sameOrigin(null, null, [ORIGIN])).toBe(false)
    expect(sameOrigin('not a url', null, [ORIGIN])).toBe(false)
  })
})

describe('POST /api/employer/section-switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    peek.mockImplementation(async (p: string) => (p === 'talent' ? { id: 'u1', email: 'pat@acme.com' } : null))
    access.mockResolvedValue({ userId: 'u1', sections: ['hiring', 'outplacement'], grants: [{ section: 'hiring' }, { section: 'outplacement' }] })
    generateLink.mockResolvedValue({ data: { properties: { action_link: 'https://proj.supabase.co/auth/v1/verify?token=abc' } }, error: null })
  })

  it('refuses a request from another origin', async () => {
    const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! }, { origin: 'https://evil.example' })))
    expect(res.status).toBe(403)
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('refuses a missing or wrong CSRF token without minting a link', async () => {
    const res = await POST(asNext(req({ to: 'outplacement' })))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/employer-home?switch=expired')
    const other = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('someone-else')! })))
    expect(other.headers.get('location')).toContain('switch=expired')
    expect(generateLink).not.toHaveBeenCalled()
  })

  it('refuses a section the person does not hold', async () => {
    const res = await POST(asNext(req({ to: 'employees', csrf: issueCsrf('u1')! })))
    expect(res.headers.get('location')).toContain('switch=no_access')
    expect(generateLink).not.toHaveBeenCalled()
    expect(capture).toHaveBeenCalledWith('u1', 'employer_section_switched', expect.objectContaining({ to: 'employees', result: 'blocked_no_access' }))
  })

  it('ignores a destination or email in the request', async () => {
    const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')!, email: 'victim@x.com', next: 'https://evil.example', redirectTo: 'https://evil.example' })))
    expect(res.status).toBe(303)
    const call = generateLink.mock.calls[0][0]
    expect(call.email).toBe('pat@acme.com')
    expect(call.options.redirectTo).toContain('/auth/callback?next=section-bridge&to=outplacement&arrival=')
    expect(call.options.redirectTo).not.toContain('evil')
  })

  it('mints a link for the signed-in email and sends the browser to Supabase with a 303', async () => {
    const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! })))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://proj.supabase.co/auth/v1/verify?token=abc')
    expect(capture).toHaveBeenCalledWith('u1', 'employer_section_switched', expect.objectContaining({ to: 'outplacement', result: 'link_issued' }))
  })

  it('does not mint a link when already signed in to the target section as the same person', async () => {
    peek.mockImplementation(async () => ({ id: 'u1', email: 'pat@acme.com' }))
    const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! })))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/employer')
    expect(generateLink).not.toHaveBeenCalled()
    expect(capture).toHaveBeenCalledWith('u1', 'employer_section_switched', expect.objectContaining({ result: 'direct' }))
  })

  it('never follows a link that is not on our Supabase project', async () => {
    generateLink.mockResolvedValue({ data: { properties: { action_link: 'https://evil.example/steal' } }, error: null })
    const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! })))
    expect(res.headers.get('location')).toContain('switch=unavailable')
  })

  describe('a section held only through a linked account', () => {
    beforeEach(() => {
      access.mockResolvedValue({ userId: 'u1', sections: ['hiring', 'outplacement'], grants: [{ section: 'hiring' }, { section: 'outplacement', viaUserId: 'u2', viaLinkId: 'l1' }] })
    })

    it('mints the sign-in link for the linked account, bound to that account, when it is a verified party to an active link', async () => {
      linkedIdentity.mockResolvedValue({ id: 'u2', email: 'pat@outplace.com' })
      const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! })))
      expect(linkedIdentity).toHaveBeenCalledWith('u1', 'u2')
      expect(generateLink.mock.calls[0][0].email).toBe('pat@outplace.com')
      const arrival = new URL(generateLink.mock.calls[0][0].options.redirectTo).searchParams.get('arrival')!
      expect(verifyArrival('u2', 'outplacement', arrival)).toBe('ok')
      expect(verifyArrival('u1', 'outplacement', arrival)).toBe('invalid')
      expect(res.headers.get('location')).toBe('https://proj.supabase.co/auth/v1/verify?token=abc')
    })

    it('mints nothing when the link is gone or the linked account is not verified', async () => {
      linkedIdentity.mockResolvedValue(null)
      const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! })))
      expect(res.headers.get('location')).toContain('switch=no_access')
      expect(generateLink).not.toHaveBeenCalled()
    })

    it('uses the person\'s own sign-in, not the linked one, for a section they hold themselves', async () => {
      peek.mockImplementation(async () => null)
      peek.mockImplementationOnce(async () => ({ id: 'u1', email: 'pat@acme.com' }))
      access.mockResolvedValue({ userId: 'u1', sections: ['outplacement'], grants: [{ section: 'outplacement' }, { section: 'outplacement', viaUserId: 'u2' }] })
      const res = await POST(asNext(req({ to: 'outplacement', csrf: issueCsrf('u1')! })))
      expect(res.status).toBe(303)
      expect(linkedIdentity).not.toHaveBeenCalled()
      expect(generateLink.mock.calls[0][0].email).toBe('pat@acme.com')
    })
  })

  it('sends a signed-out visitor back to the front door', async () => {
    peek.mockResolvedValue(null)
    const res = await POST(asNext(req({ to: 'hiring', csrf: issueCsrf('u1')! })))
    expect(res.headers.get('location')).toContain('switch=signed_out')
    expect(generateLink).not.toHaveBeenCalled()
  })
})

describe('the bridge changes no cookie', () => {
  it('neither the route nor the bridge library touches cookies or the session code', async () => {
    const { readFileSync } = await import('node:fs')
    const files = ['src/app/api/employer/section-switch/route.ts', 'src/lib/employer/section-bridge.ts', 'src/lib/employer/section-bridge-server.ts']
    for (const f of files) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(src).not.toMatch(/cookies\(\)\.set|\.cookies\.set|PORTAL_COOKIE_NAMES|setAll|updateSession/)
    }
  })
})
