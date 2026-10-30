import 'server-only'
import { createHash } from 'node:crypto'
import { createResend } from '@/lib/email/resend-client'
import { allowRequest, DAY_MS } from '@/lib/security/rate-limit'

/** Same inbox as new help requests. Override with HELP_FORWARD_TO. */
const ADMIN_TO = process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'
const MAIN_HOSTS = ['launchyournextchapter.com', 'www.launchyournextchapter.com', 'admin.launchyournextchapter.com']

// Scanners hit these constantly; they are not a broken link on our site.
export const PROBE = /(\.(php|asp|aspx|jsp|env|git|sql|bak|zip|ini|xml)(\/|$))|wp-|xmlrpc|phpmyadmin|cgi-bin|\.well-known|\/\./i

/**
 * A page that a merge adds is a 404 from the old deploy until the new one is live, a few minutes later. The alert waits
 * this long and looks again, so only a page that is still missing after the deploy reaches the inbox.
 */
export const RECHECK_AFTER_MS = 4 * 60_000

async function stillMissing(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    return res.status === 404
  } catch {
    return true
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null
  const p = raw.split('?')[0].slice(0, 200)
  return /^\/[\w\-./%~@+]*$/.test(p) ? p : null
}

/**
 * Emails the owner that a visitor hit a missing page. One email per address per day, and at most 20 a day
 * in total, so a crawler cannot fill the inbox. Returns whether an email was sent.
 * A page that is no longer a 404 after `recheckAfterMs` (a deploy finished meanwhile) is not reported.
 */
export async function alertNotFound(input: { path: unknown; host: unknown; referrer: unknown }, recheckAfterMs = RECHECK_AFTER_MS): Promise<boolean> {
  const path = cleanPath(input.path)
  const host = typeof input.host === 'string' ? input.host.toLowerCase() : ''
  if (!path || !MAIN_HOSTS.includes(host) || PROBE.test(path)) return false
  if (!process.env.RESEND_API_KEY) return false

  const key = createHash('sha256').update(`${host}${path}`).digest('hex').slice(0, 32)
  if (!(await allowRequest({ bucket: 'not-found-alert', key, limit: 1, windowMs: DAY_MS }))) return false
  if (!(await allowRequest({ bucket: 'not-found-alert-all', key: 'all', limit: 20, windowMs: DAY_MS }))) return false

  let from = ''
  try {
    if (typeof input.referrer === 'string' && input.referrer) {
      const r = new URL(input.referrer)
      from = r.origin + r.pathname
    }
  } catch {
    // Not a URL.
  }
  const url = `https://${host}${path}`
  if (recheckAfterMs > 0) {
    await new Promise((r) => setTimeout(r, recheckAfterMs))
    if (!(await stillMissing(url))) return false
  }
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
      from: FROM,
      to: ADMIN_TO,
      subject: `404: ${host}${path}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0f1b2b;line-height:1.5"><p style="margin:0 0 12px;font-size:17px;font-weight:600">A visitor hit a page that doesn’t exist</p><p style="margin:0 0 4px">Address: ${esc(url)}</p><p style="margin:0 0 4px;color:#55606e">Came from: ${from ? esc(from) : 'typed or bookmarked'}</p><p style="margin:12px 0 0;color:#55606e;font-size:13px">You get one email per address per day, at most 20 a day.</p></div>`,
      text: `A visitor hit a page that doesn’t exist\n\nAddress: ${url}\nCame from: ${from || 'typed or bookmarked'}`,
    })
    if (error) { console.error('404 alert failed:', error); return false }
    return true
  } catch (e) {
    console.error('404 alert failed:', e)
    return false
  }
}
