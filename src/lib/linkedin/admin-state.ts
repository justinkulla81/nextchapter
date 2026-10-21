import 'server-only'
import crypto from 'crypto'

// Same idea as src/lib/google/admin-oauth-state.ts: the LinkedIn callback lands
// on the candidate host, where the admin session cookie does not exist, so it
// cannot call requireAdmin(). The admin-gated /start mints a signed, expiring
// state and the callback treats a request as the admin's only when that
// signature checks out. Anything else falls through to the candidate flow.
const TTL_MS = 10 * 60 * 1000
const PREFIX = 'admin.'

function key(): string | null {
  const secret = process.env.LINKEDIN_CLIENT_SECRET
  return secret ? crypto.createHmac('sha256', secret).update('admin-linkedin-oauth-state:v1').digest('hex') : null
}

const sign = (payload: string, k: string) => crypto.createHmac('sha256', k).update(payload).digest('base64url')

export function mintAdminLinkedInState(adminEmail: string): string {
  const k = key()
  if (!k) throw new Error('LINKEDIN_CLIENT_SECRET is not configured')
  const payload = Buffer.from(JSON.stringify({ e: adminEmail, x: Date.now() + TTL_MS, n: crypto.randomBytes(8).toString('hex') })).toString('base64url')
  return `${PREFIX}${payload}.${sign(payload, k)}`
}

/** The admin email the state was minted for, or null when it is not an admin state, forged or expired. */
export function verifyAdminLinkedInState(state: string | null): { adminEmail: string } | null {
  const k = key()
  if (!k || !state?.startsWith(PREFIX)) return null
  const [payload, sig, ...rest] = state.slice(PREFIX.length).split('.')
  if (!payload || !sig || rest.length) return null
  const expected = Buffer.from(sign(payload, k))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { e?: unknown; x?: unknown }
    if (typeof d.x !== 'number' || d.x < Date.now() || typeof d.e !== 'string' || !d.e) return null
    return { adminEmail: d.e }
  } catch {
    return null
  }
}
