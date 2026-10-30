import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// One-click Done / Pause links for the follow-ups listed in the daily digest.
// The link is the credential, so it is signed (HMAC of person, action, expiry
// and the follow-up date it was issued for) and expires. Issuing a link needs
// the Bearer key (see /api/admin/crm/digest-links); using one needs nothing,
// the same way an unsubscribe link works.
export type DigestAction = 'done' | 'pause'

export const PAUSE_DAYS = 7
const LINK_TTL_DAYS = 14
const MIN_SECRET_LENGTH = 16

function secret(): string | null {
  const s = process.env.NC_ATS_API_KEY
  return s && s.length >= MIN_SECRET_LENGTH ? `digest-action:${s}` : null
}

function sign(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

export function dueKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function signDigestAction(personId: string, action: DigestAction, dueAt: Date, now = new Date()): string | null {
  const key = secret()
  if (!key) return null
  const exp = Math.floor(now.getTime() / 1000) + LINK_TTL_DAYS * 86400
  const body = `${personId}.${action}.${exp}.${dueKey(dueAt)}`
  return `${Buffer.from(body).toString('base64url')}.${sign(body, key)}`
}

export type VerifiedDigestAction = { personId: string; action: DigestAction; due: string }

export function verifyDigestAction(token: string, now = new Date()): VerifiedDigestAction | null {
  const key = secret()
  if (!key) return null
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null
  let body: string
  try {
    body = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = Buffer.from(sign(body, key))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  const [personId, action, exp, due] = body.split('.')
  if (!personId || (action !== 'done' && action !== 'pause') || !due) return null
  if (Number(exp) < now.getTime() / 1000) return null
  return { personId, action, due }
}
