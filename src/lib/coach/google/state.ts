import 'server-only'
import crypto from 'crypto'

// Same pattern as src/lib/google/admin-oauth-state.ts: /start (coach-gated) mints a signed, expiring state that
// carries the coach id, and the callback accepts nothing else. The callback lands on whichever host
// NEXT_PUBLIC_APP_URL names, which may not hold the coach's session cookie, so it cannot call getCurrentCoach().
// Signed with the coach client's own secret, so a state minted for another Google client never verifies here.
const TTL_MS = 10 * 60 * 1000

function key(): string | null {
  const secret = process.env.COACH_GOOGLE_CLIENT_SECRET
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update('coach-google-oauth-state:v1').digest('hex')
}

function sign(payload: string, k: string): string {
  return crypto.createHmac('sha256', k).update(payload).digest('base64url')
}

export function mintCoachOAuthState(coachId: string, now = Date.now()): string {
  const k = key()
  if (!k) throw new Error('Coach Google OAuth client secret is not configured')
  const payload = Buffer.from(JSON.stringify({ c: coachId, x: now + TTL_MS, n: crypto.randomBytes(8).toString('hex') })).toString('base64url')
  return `${payload}.${sign(payload, k)}`
}

export function verifyCoachOAuthState(state: string | null, now = Date.now()): { coachId: string } | null {
  const k = key()
  if (!k || !state) return null
  const [payload, sig, ...rest] = state.split('.')
  if (!payload || !sig || rest.length) return null
  const expected = Buffer.from(sign(payload, k))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { c?: unknown; x?: unknown }
    if (typeof d.x !== 'number' || d.x < now || typeof d.c !== 'string' || !d.c) return null
    return { coachId: d.c }
  } catch {
    return null
  }
}
