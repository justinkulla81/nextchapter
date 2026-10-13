import 'server-only'
import crypto from 'crypto'

// The admin Google callback can't read the admin session cookie (it lands on
// the apex host; the cookie is host-only on the admin subdomain), so it can't
// call requireAdmin(). Instead /start — which IS admin-gated — mints a signed,
// expiring state, and the callback accepts nothing else. Without this, anyone
// could replay their own Google `code` against the callback with a hand-made
// state and replace the founder's Gmail/Calendar connection.
const TTL_MS = 10 * 60 * 1000

function key(): string | null {
  const secret = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update('admin-google-oauth-state:v1').digest('hex')
}

function sign(payload: string, k: string): string {
  return crypto.createHmac('sha256', k).update(payload).digest('base64url')
}

export interface AdminOAuthState {
  returnPath: string
  adminEmail: string | null
}

export function mintAdminOAuthState(s: AdminOAuthState): string {
  const k = key()
  if (!k) throw new Error('Google OAuth client secret is not configured')
  const payload = Buffer.from(
    JSON.stringify({ p: s.returnPath, e: s.adminEmail, x: Date.now() + TTL_MS, n: crypto.randomBytes(8).toString('hex') }),
  ).toString('base64url')
  return `${payload}.${sign(payload, k)}`
}

export function verifyAdminOAuthState(state: string | null): AdminOAuthState | null {
  const k = key()
  if (!k || !state) return null
  const [payload, sig, ...rest] = state.split('.')
  if (!payload || !sig || rest.length) return null
  const expected = Buffer.from(sign(payload, k))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p?: unknown; e?: unknown; x?: unknown }
    if (typeof d.x !== 'number' || d.x < Date.now()) return null
    const returnPath = typeof d.p === 'string' && d.p.startsWith('/support/admin/') ? d.p : '/support/admin/digest'
    return { returnPath, adminEmail: typeof d.e === 'string' && d.e ? d.e : null }
  } catch {
    return null
  }
}
