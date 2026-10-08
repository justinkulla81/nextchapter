import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies a Resend webhook (Resend signs with Svix): HMAC-SHA256 over
 * `${id}.${timestamp}.${payload}` with the base64 secret after `whsec_`,
 * compared against each `v1,<sig>` in the svix-signature header. Rejects
 * timestamps more than five minutes off, so a captured request can't be
 * replayed later.
 */
export function verifyResendSignature(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now: number = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature || !secret) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest()
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    const given = Buffer.from(sig, 'base64')
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true
  }
  return false
}
