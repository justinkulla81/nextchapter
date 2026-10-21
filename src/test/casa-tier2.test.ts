import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync, createSign, type KeyObject } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'

// CASA Tier 2 gaps closed 2026-10-21: browser storage on logout (6.6.1),
// re-auth before irreversible actions (2.4.1), Gmail push OIDC (2.1.1 / 6.5.1),
// admin MFA (3.3.1), and the advisor's mutable search_path.

// ---- shared mocks ---------------------------------------------------------
const captured: { event: string; props?: Record<string, unknown> }[] = []
vi.mock('@/lib/posthog/server', () => ({
  captureServerEvent: (_id: string, event: string, props?: Record<string, unknown>) => captured.push({ event, props }),
}))
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`)
})
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to), notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }))
const headerValues: Record<string, string> = {}
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => headerValues[k] ?? null }),
  cookies: async () => ({ getAll: () => [], set: vi.fn(), get: () => undefined }),
}))

const auth = {
  getUser: vi.fn(),
  getClaims: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(async () => ({})),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth }) }))
const generateLink = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { generateLink } } }) }))
const sendReauthCodeEmail = vi.fn(async (_a: unknown) => true)
vi.mock('@/lib/email/send-reauth-code', () => ({ sendReauthCodeEmail: (a: unknown) => sendReauthCodeEmail(a) }))
const allowRequest = vi.fn(async (_a: unknown) => true)
vi.mock('@/lib/security/rate-limit', () => ({ allowRequest: (a: unknown) => allowRequest(a), HOUR_MS: 3600000 }))
const deleteGoogleDataForCandidate = vi.fn(async (_id: string) => ({ emails: 1, calendarEvents: 0, scamAlerts: 0, platformEmails: 0, grantRevoked: true, hadTokens: true }))
vi.mock('@/lib/google/delete-google-data', () => ({ deleteGoogleDataForCandidate: (id: string) => deleteGoogleDataForCandidate(id) }))
vi.mock('@/lib/profile', () => ({ getOrCreateCandidateProfile: async () => ({ id: 'cand_1' }) }))
const profileUpdate = vi.fn(async (_a: unknown) => ({}))
const roleGrantFind = vi.fn(async (_a: unknown) => null)
vi.mock('@/lib/prisma', () => ({
  prisma: { candidateProfile: { update: (a: unknown) => profileUpdate(a) }, roleGrant: { findFirst: (a: unknown) => roleGrantFind(a) } },
}))

const NOW = 1_800_000_000
const user = { id: 'u1', email: 'pat@example.org' }

beforeEach(() => {
  captured.length = 0
  vi.clearAllMocks()
  auth.getUser.mockResolvedValue({ data: { user } })
})
afterEach(() => vi.unstubAllEnvs())

// ---- 1. browser storage on logout ----------------------------------------
class MemStorage {
  m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, v) }
}

describe('clear browser storage on logout (CASA 6.6.1)', () => {
  it('removes every key except the allowlisted UI preferences', async () => {
    const { clearStorageExceptKept } = await import('@/lib/security/clear-browser-storage')
    const s = new MemStorage()
    for (const k of ['nc-menu-collapsed', 'admin-nav-collapsed', 'rounds:interview', 'job-review-dismissed', 'ph_phc_x_posthog', 'search-strategy:cand_1', 'anything-new']) s.setItem(k, 'v')
    expect(clearStorageExceptKept(s)).toBe(5)
    expect([...s.m.keys()].sort()).toEqual(['admin-nav-collapsed', 'nc-menu-collapsed'])
    expect(clearStorageExceptKept(null)).toBe(0)
  })

  it('finds PostHog cookies to expire', async () => {
    const { posthogCookieNames } = await import('@/lib/security/clear-browser-storage')
    expect(posthogCookieNames('a=1; ph_phc_abc_posthog=%7B%7D; _ga=GA1; sb-x-auth-token=t')).toEqual(['ph_phc_abc_posthog'])
  })

  it('every sign-out form in the app goes through SignOutForm', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx$/.test(name) && /<form\s+action=\{\s*(signOut|access\.via)/.test(readFileSync(p, 'utf-8'))) offenders.push(p)
      }
    }
    walk(path.resolve(__dirname, '..'))
    expect(offenders).toEqual([])
  })
})

// ---- 2. re-auth before irreversible actions --------------------------------
describe('recent-auth helpers', () => {
  it('uses the latest real sign-in from amr and ignores anonymous', async () => {
    const { lastAuthenticatedAt, isRecentAuth } = await import('@/lib/auth/recent-auth')
    const claims = { amr: [{ method: 'anonymous', timestamp: NOW }, { method: 'password', timestamp: NOW - 3600 }] }
    expect(lastAuthenticatedAt(claims)).toBe(NOW - 3600)
    expect(isRecentAuth(claims, NOW)).toBe(false)
    expect(isRecentAuth({ amr: [{ method: 'otp', timestamp: NOW - 300 }] }, NOW)).toBe(true)
    expect(isRecentAuth({ amr: [{ method: 'otp', timestamp: NOW - 601 }] }, NOW)).toBe(false)
    expect(isRecentAuth({ amr: [{ method: 'otp', timestamp: NOW + 3600 }] }, NOW)).toBe(false)
    expect(isRecentAuth({}, NOW)).toBe(false)
    expect(isRecentAuth(null, NOW)).toBe(false)
  })

  it('normalizes codes and masks emails', async () => {
    const { normalizeOtp, maskEmail } = await import('@/lib/auth/recent-auth')
    expect(normalizeOtp(' 123 456 ')).toBe('123456')
    expect(normalizeOtp('12345')).toBeNull()
    expect(normalizeOtp(undefined)).toBeNull()
    expect(maskEmail('pat@example.org')).toBe('p•••@example.org')
  })
})

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('Delete my Google data needs a fresh sign-in (CASA 2.4.1)', () => {
  it('stale session: emails a code, deletes nothing, fires challenge_shown', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 7200 }] } } })
    generateLink.mockResolvedValue({ data: { properties: { email_otp: '424242' } }, error: null })
    const { deleteMyGoogleData } = await import('@/app/dashboard/privacy/google-data-actions')
    const r = await deleteMyGoogleData(undefined, form({ confirmation: 'DELETE' }))
    expect(r).toEqual({ ok: false, reauth: { sentTo: 'p•••@example.org', error: undefined } })
    expect(deleteGoogleDataForCandidate).not.toHaveBeenCalled()
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'pat@example.org' })
    expect(sendReauthCodeEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'pat@example.org', code: '424242' }))
    expect(captured.map((c) => c.event)).toContain('reauth_challenge_shown')
  })

  it('recent sign-in: deletes straight away', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - 60 }] } } })
    const { deleteMyGoogleData } = await import('@/app/dashboard/privacy/google-data-actions')
    const r = await deleteMyGoogleData(undefined, form({ confirmation: 'DELETE' }))
    expect(r?.ok).toBe(true)
    expect(generateLink).not.toHaveBeenCalled()
    expect(captured).toContainEqual({ event: 'reauth_challenge_passed', props: { action: 'delete_google_data', method: 'recent_session' } })
  })

  it('right code: verifies it as a Supabase email OTP, then deletes', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null })
    const { deleteMyGoogleData } = await import('@/app/dashboard/privacy/google-data-actions')
    const r = await deleteMyGoogleData(undefined, form({ confirmation: 'DELETE', reauthCode: '424 242' }))
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'pat@example.org', token: '424242', type: 'email' })
    expect(r?.ok).toBe(true)
    expect(captured).toContainEqual({ event: 'reauth_challenge_passed', props: { action: 'delete_google_data', method: 'email_code' } })
  })

  it('wrong code: nothing deleted, asks again', async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    const { deleteMyGoogleData } = await import('@/app/dashboard/privacy/google-data-actions')
    const r = await deleteMyGoogleData(undefined, form({ confirmation: 'DELETE', reauthCode: '111111' }))
    expect(r && !r.ok && r.reauth?.error).toMatch(/didn’t work/)
    expect(deleteGoogleDataForCandidate).not.toHaveBeenCalled()
  })

  it('rate limited: says so instead of sending', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { amr: [] } } })
    allowRequest.mockResolvedValueOnce(false)
    const { deleteMyGoogleData } = await import('@/app/dashboard/privacy/google-data-actions')
    const r = await deleteMyGoogleData(undefined, form({ confirmation: 'DELETE' }))
    expect(r && !r.ok && r.reauth?.error).toMatch(/several codes/)
    expect(generateLink).not.toHaveBeenCalled()
  })
})

describe('Deactivate my account needs a fresh sign-in (CASA 2.4.1)', () => {
  it('stale session: challenge, no deactivation', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: 'oauth', timestamp: 1 }] } } })
    generateLink.mockResolvedValue({ data: { properties: { email_otp: '999999' } }, error: null })
    const { deactivateMyAccount } = await import('@/app/dashboard/privacy/actions')
    const r = await deactivateMyAccount(undefined, form({ confirmation: 'DEACTIVATE' }))
    expect(r?.reauth?.sentTo).toBe('p•••@example.org')
    expect(profileUpdate).not.toHaveBeenCalled()
  })

  it('fresh session: deactivates, signs out, lands on the page that clears the browser', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] } } })
    const { deactivateMyAccount } = await import('@/app/dashboard/privacy/actions')
    await expect(deactivateMyAccount(undefined, form({ confirmation: 'DEACTIVATE' }))).rejects.toThrow('REDIRECT /account-deactivated')
    expect(profileUpdate).toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalled()
  })
})

// ---- 3. Gmail push OIDC ----------------------------------------------------
const AUD = 'https://launchyournextchapter.com/api/google/gmail-push'
const SA = 'gmail-push@proj.iam.gserviceaccount.com'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })

function jwt(payload: Record<string, unknown>, key: KeyObject = privateKey, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1', typ: 'JWT' }) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${enc(header)}.${enc(payload)}`
  const sig = createSign('RSA-SHA256').update(body).sign(key).toString('base64url')
  return `Bearer ${body}.${sig}`
}
const good = () => ({ iss: 'https://accounts.google.com', aud: AUD, email: SA, email_verified: true, iat: NOW - 10, exp: NOW + 3500, sub: '123' })
const getKey = async (kid: string) => (kid === 'k1' ? publicKey : null)

describe('Pub/Sub OIDC push token (CASA 2.1.1 / 6.5.1)', () => {
  const cfg = { audience: AUD, serviceAccount: SA }
  it('accepts a correctly signed token for our audience and service account', async () => {
    const { verifyPubSubOidcToken } = await import('@/lib/email-tracking/pubsub-oidc')
    expect(await verifyPubSubOidcToken(jwt(good()), cfg, { getKey, nowSeconds: NOW })).toEqual({ ok: true, email: SA })
  })

  it.each([
    ['no bearer', null, 'no_bearer'],
    ['another signer', jwt(good(), other.privateKey), 'bad_signature'],
    ['unknown kid', jwt(good(), privateKey, { alg: 'RS256', kid: 'zz' }), 'unknown_kid'],
    ['alg none', jwt(good(), privateKey, { alg: 'none', kid: 'k1' }), 'bad_alg'],
    ['wrong audience', jwt({ ...good(), aud: 'https://evil.example/push' }), 'bad_audience'],
    ['wrong issuer', jwt({ ...good(), iss: 'https://evil.example' }), 'bad_issuer'],
    ['expired', jwt({ ...good(), exp: NOW - 120 }), 'expired'],
    ['other service account', jwt({ ...good(), email: 'someone@else.iam.gserviceaccount.com' }), 'wrong_service_account'],
    ['unverified email', jwt({ ...good(), email_verified: false }), 'email_unverified'],
  ])('refuses %s', async (_label, header, reason) => {
    const { verifyPubSubOidcToken } = await import('@/lib/email-tracking/pubsub-oidc')
    expect(await verifyPubSubOidcToken(header, cfg, { getKey, nowSeconds: NOW })).toEqual({ ok: false, reason })
  })

  it('config: OIDC by service account; URL token only behind GMAIL_PUSH_ALLOW_URL_TOKEN', async () => {
    const { gmailPushAuth, isGmailPushConfigured } = await import('@/lib/email-tracking/gmail-push')
    expect(gmailPushAuth({ GMAIL_PUSH_SERVICE_ACCOUNT: SA })).toEqual({ oidc: { serviceAccount: SA, audience: AUD }, urlToken: null })
    expect(gmailPushAuth({ GMAIL_PUSH_SECRET: 's' }).urlToken).toBeNull()
    expect(gmailPushAuth({ GMAIL_PUSH_SECRET: 's', GMAIL_PUSH_ALLOW_URL_TOKEN: 'true' }).urlToken).toBe('s')
    expect(isGmailPushConfigured({ GMAIL_PUSH_TOPIC: 't', GMAIL_PUSH_SECRET: 's' })).toBe(false)
    expect(isGmailPushConfigured({ GMAIL_PUSH_TOPIC: 't', GMAIL_PUSH_SERVICE_ACCOUNT: SA })).toBe(true)
    expect(isGmailPushConfigured({})).toBe(false)
  })

  it('endpoint refuses ?token= once OIDC is the only mode', async () => {
    vi.stubEnv('GMAIL_PUSH_TOPIC', 'projects/p/topics/t')
    vi.stubEnv('GMAIL_PUSH_SERVICE_ACCOUNT', SA)
    vi.stubEnv('GMAIL_PUSH_SECRET', 'legacy-secret')
    const { POST } = await import('@/app/api/google/gmail-push/route')
    const res = await POST(new NextRequest(`${AUD}?token=legacy-secret`, { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('endpoint still takes ?token= while GMAIL_PUSH_ALLOW_URL_TOKEN=true', async () => {
    vi.stubEnv('GMAIL_PUSH_TOPIC', 'projects/p/topics/t')
    vi.stubEnv('GMAIL_PUSH_SECRET', 'legacy-secret')
    vi.stubEnv('GMAIL_PUSH_ALLOW_URL_TOKEN', 'true')
    const { POST } = await import('@/app/api/google/gmail-push/route')
    const res = await POST(new NextRequest(`${AUD}?token=legacy-secret`, { method: 'POST', body: '{}' }))
    expect(res.status).toBe(204)
  })
})

// ---- 4. admin MFA -----------------------------------------------------------
describe('admin two-step login (CASA 3.3.1)', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAILS', 'pat@example.org')
    headerValues['x-pathname'] = '/support/admin/crm'
    headerValues['x-search'] = '?tab=people'
  })

  it('flag off (default): an aal1 admin session passes, as today', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { aal: 'aal1' } } })
    const { requireAdmin } = await import('@/lib/admin/auth')
    await expect(requireAdmin()).resolves.toEqual(user)
  })

  it('flag on: aal1 goes to the two-step page and comes back to the page it asked for', async () => {
    vi.stubEnv('ADMIN_MFA_REQUIRED', 'true')
    auth.getClaims.mockResolvedValue({ data: { claims: { aal: 'aal1' } } })
    const { requireAdmin } = await import('@/lib/admin/auth')
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT /support/admin/mfa?next=${encodeURIComponent('/support/admin/crm?tab=people')}`)
  })

  it('flag on: aal2 passes', async () => {
    vi.stubEnv('ADMIN_MFA_REQUIRED', 'true')
    auth.getClaims.mockResolvedValue({ data: { claims: { aal: 'aal2' } } })
    const { requireAdmin } = await import('@/lib/admin/auth')
    await expect(requireAdmin()).resolves.toEqual(user)
  })

  it('non-admins still go to the dashboard, never the MFA page', async () => {
    vi.stubEnv('ADMIN_MFA_REQUIRED', 'true')
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u2', email: 'someone@example.org' } } })
    const { requireAdminSession } = await import('@/lib/admin/auth')
    await expect(requireAdminSession()).rejects.toThrow('REDIRECT /dashboard')
  })

  it('redirect target never loops into the MFA page or leaves the site', async () => {
    const { adminMfaRedirect } = await import('@/lib/admin/mfa')
    expect(adminMfaRedirect('/support/admin/mfa', '?next=/x')).toBe('/support/admin/mfa?next=%2Fsupport%2Fadmin')
    expect(adminMfaRedirect('//evil.example', '')).toBe('/support/admin/mfa?next=%2Fsupport%2Fadmin')
    expect(adminMfaRedirect(null)).toBe('/support/admin/mfa?next=%2Fsupport%2Fadmin')
  })

  it('org portals: NextChapter-admin powers need aal2 when the flag is on', async () => {
    const { isNcAdmin } = await import('@/lib/higher-ed/resolve')
    expect(await isNcAdmin('u1', 'pat@example.org', undefined, 'aal1')).toBe(true)
    vi.stubEnv('ADMIN_MFA_REQUIRED', 'true')
    expect(await isNcAdmin('u1', 'pat@example.org', undefined, 'aal1')).toBe(false)
    expect(await isNcAdmin('u1', 'pat@example.org')).toBe(false)
    expect(await isNcAdmin('u1', 'pat@example.org', undefined, 'aal2')).toBe(true)
  })
})

// ---- 5. advisor: mutable search_path ------------------------------------------
describe('function search_path (Supabase advisor 0011)', () => {
  it('employer_outcomes_by_bucket pins search_path in its source and its manual migration', () => {
    const root = path.resolve(__dirname, '../..')
    expect(readFileSync(path.join(root, 'prisma/sql/employer-outcomes.sql'), 'utf-8')).toMatch(/stable\nset search_path = ''\nas \$\$/)
    expect(readFileSync(path.join(root, 'prisma/manual/2026-10-21-function-search-path.sql'), 'utf-8')).toContain(
      "ALTER FUNCTION private.employer_outcomes_by_bucket(text, timestamptz) SET search_path = '';",
    )
  })
})
