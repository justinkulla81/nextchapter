import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// First-party click tracking for Job Search Daily. Resend's own click
// tracking is off for the sending domain (it would rewrite every link in
// sign-in mail too), so each link in the email points at /api/e/jsd, which
// records the click on the JobSearchDailySend row and redirects. The target
// is signed so the endpoint can't be used as an open redirect.

function key(): string {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET is not set')
  return createHmac('sha256', secret).update('jsd-click-v1').digest('hex')
}

function sign(sendId: string, url: string): string {
  return createHmac('sha256', key()).update(`${sendId}\n${url}`).digest('base64url')
}

export function buildClickUrl(appUrl: string, sendId: string, url: string): string {
  const u = Buffer.from(url, 'utf8').toString('base64url')
  return `${appUrl}/api/e/jsd?s=${encodeURIComponent(sendId)}&u=${u}&t=${sign(sendId, url)}`
}

export function readClickUrl(params: URLSearchParams): { sendId: string; url: string } | null {
  const sendId = params.get('s')
  const u = params.get('u')
  const t = params.get('t')
  if (!sendId || !u || !t) return null
  let url: string
  try {
    url = Buffer.from(u, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = Buffer.from(sign(sendId, url))
  const given = Buffer.from(t)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (!/^https?:\/\//i.test(url)) return null
  return { sendId, url }
}

/** Returns a copy of `value` with every string `href` field passed through `wrap`. */
export function wrapHrefs<T>(value: T, wrap: (url: string) => string): T {
  if (Array.isArray(value)) return value.map((v) => wrapHrefs(v, wrap)) as unknown as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === 'href' && typeof v === 'string' && /^https?:\/\//i.test(v) ? wrap(v) : wrapHrefs(v, wrap)
    }
    return out as T
  }
  return value
}
