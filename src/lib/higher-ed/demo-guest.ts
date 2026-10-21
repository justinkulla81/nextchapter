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
