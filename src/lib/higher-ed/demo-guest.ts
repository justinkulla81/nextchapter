// A guest pass to one demo org, for a prospect who generated it without a
// NextChapter account: an HMAC-signed cookie naming the demo's slug. It only
// ever opens a demo (isDemo, sample data), always read-only, never a real
// org. The key is derived from a server secret, so it can't be forged.

import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

export const DEMO_GUEST_COOKIE = 'he_demo_guest'
export const DEMO_GUEST_DAYS = 30

function key(): string {
  const base = process.env.DEMO_GUEST_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET
  if (!base) throw new Error('No server secret for demo guest passes')
  return createHmac('sha256', base).update('nc-demo-guest-v1').digest('hex')
}

const sign = (slugs: string) => createHmac('sha256', key()).update(slugs).digest('base64url')

// The cookie holds every demo this browser generated: "a,b.sig".
export function guestCookieValue(slugs: string[]): string {
  const list = [...new Set(slugs)].slice(-5).join(',')
  return `${list}.${sign(list)}`
}

export function guestSlugs(value: string | undefined | null): string[] {
  if (!value) return []
  const i = value.lastIndexOf('.')
  if (i < 1) return []
  const list = value.slice(0, i)
  const sig = value.slice(i + 1)
  try {
    const want = Buffer.from(sign(list))
    const got = Buffer.from(sig)
    if (want.length !== got.length || !timingSafeEqual(want, got)) return []
  } catch {
    return []
  }
  return list.split(',').filter(Boolean)
}

// A guest link a NextChapter admin (or the prospect) sends: /<slug>/guest/<token> hands out the same read-only pass the
// demo's generator got, then opens the demo. The token is "<expiry>.<signature of slug and expiry>", so a link opens only
// its own demo and stops working after GUEST_LINK_DAYS.
export const GUEST_LINK_DAYS = 90
const DAY_MS = 86_400_000
const linkSig = (slug: string, exp: string) => createHmac('sha256', key()).update(`link:${slug}:${exp}`).digest('base64url').slice(0, 32)

export function guestLinkToken(slug: string, now = Date.now()): string {
  // Expiry on a day boundary, so the link shown stays the same all day.
  const exp = (Math.floor(now / DAY_MS) + GUEST_LINK_DAYS).toString(36)
  return `${exp}.${linkSig(slug, exp)}`
}

export function guestLinkValid(slug: string, token: string, now = Date.now()): boolean {
  const i = token.indexOf('.')
  if (i < 1) return false
  const exp = token.slice(0, i)
  const days = parseInt(exp, 36)
  if (!Number.isFinite(days) || days * DAY_MS < now) return false
  try {
    const want = Buffer.from(linkSig(slug, exp))
    const got = Buffer.from(token.slice(i + 1))
    return want.length === got.length && timingSafeEqual(want, got)
  } catch {
    return false
  }
}
