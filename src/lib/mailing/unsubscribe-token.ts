import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The token in every unsubscribe link: the address and the edition it came
 * from, signed. Works without signing in and can't be forged for someone
 * else's address. No table — the signature is the proof.
 */

function secret(): string {
  const s = process.env.MAILING_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET
  if (!s) throw new Error('MAILING_UNSUBSCRIBE_SECRET (or CRON_SECRET) must be set to sign unsubscribe links')
  return s
}

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf-8')
const sign = (body: string, key: string) => createHmac('sha256', key).update(body).digest('base64url').slice(0, 32)

export function makeUnsubscribeToken(email: string, editionId: string | null, key = secret()): string {
  const body = `${b64(email.toLowerCase())}.${editionId ? b64(editionId) : ''}`
  return `${body}.${sign(body, key)}`
}

export function readUnsubscribeToken(token: string, key = secret()): { email: string; editionId: string | null } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const body = `${parts[0]}.${parts[1]}`
  const expected = Buffer.from(sign(body, key))
  const given = Buffer.from(parts[2])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    return { email: unb64(parts[0]), editionId: parts[1] ? unb64(parts[1]) : null }
  } catch {
    return null
  }
}
