import { createHash, randomBytes } from 'crypto'

export const CLAIM_TOKEN_DAYS = 7

/** A new one-time token. Only its hash is stored; the token itself goes in the email and nowhere else. */
export function newClaimToken(now: Date = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashClaimToken(token), expiresAt: new Date(now.getTime() + CLAIM_TOKEN_DAYS * 86_400_000) }
}

export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type TokenState = 'ok' | 'expired' | 'used'

/** A claim's link state: used once, it is spent for good; past its expiry it is dead. */
export function tokenState(c: { expiresAt: Date; verifiedAt: Date | null }, now: Date = new Date()): TokenState {
  if (c.verifiedAt) return 'used'
  return c.expiresAt.getTime() <= now.getTime() ? 'expired' : 'ok'
}

/** A salted hash of the requester's IP, kept only to limit how fast claims can be requested. */
export function hashIp(ip: string, salt: string = process.env.ORG_CLAIM_IP_SALT || 'org-claim'): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}
