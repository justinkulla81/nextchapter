import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// First-party click tracking for the weekly lifecycle emails (Resend's own
// click tracking is off for the sending domain). Each tracked link points at
// /api/e/go, which fires a PostHog `email_clicked` event and redirects. The
// target is signed so the endpoint cannot be used as an open redirect.

function key(): string | null {
  const secret = process.env.CRON_SECRET
  return secret ? createHmac('sha256', secret).update('email-click-v1').digest('hex') : null
}

function sign(k: string, candidateId: string, emailKey: string, url: string): string {
  return createHmac('sha256', k).update(`${candidateId}\n${emailKey}\n${url}`).digest('base64url')
}

/** A tracked link for `url`; falls back to the plain URL if signing is unavailable, so a send is never blocked. */
export function buildEmailClickUrl(appUrl: string, candidateId: string, emailKey: string, url: string): string {
  const k = key()
  if (!k) return url
  const u = Buffer.from(url, 'utf8').toString('base64url')
  return `${appUrl}/api/e/go?c=${encodeURIComponent(candidateId)}&k=${encodeURIComponent(emailKey)}&u=${u}&t=${sign(k, candidateId, emailKey, url)}`
}

export function readEmailClickUrl(params: URLSearchParams): { candidateId: string; emailKey: string; url: string } | null {
  const candidateId = params.get('c')
  const emailKey = params.get('k')
  const u = params.get('u')
  const t = params.get('t')
  const k = key()
  if (!candidateId || !emailKey || !u || !t || !k) return null
  let url: string
  try {
    url = Buffer.from(u, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = Buffer.from(sign(k, candidateId, emailKey, url))
  const given = Buffer.from(t)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (!/^https?:\/\//i.test(url)) return null
  return { candidateId, emailKey, url }
}
