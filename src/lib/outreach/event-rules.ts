import type { ResendEvent } from '@/lib/mailing/tracking'

type Tagged = ResendEvent & { data: ResendEvent['data'] & { tags?: Record<string, string> | { name: string; value: string }[] } }

/** True when the email was sent with the Resend tag `outreach` (any value). Resend sends tags as an object or a list. */
export function isOutreachEvent(event: ResendEvent): boolean {
  const tags = (event as Tagged).data?.tags
  if (!tags) return false
  return Array.isArray(tags) ? tags.some((t) => t.name === 'outreach') : Object.prototype.hasOwnProperty.call(tags, 'outreach')
}

/** A temporary bounce is Resend still trying; only a permanent one is final. */
export function isPermanentBounce(event: ResendEvent): boolean {
  return !/transient|temporary/i.test(event.data?.bounce?.type ?? '')
}

/** The bare address from a recipient that may carry a display name: "UD Office <career@udallas.edu>" gives "career@udallas.edu". */
export function bareAddress(to: string | undefined): string | null {
  if (!to) return null
  const m = /<([^<>\s]+@[^<>\s]+)>/.exec(to)
  const addr = (m ? m[1] : to).trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+$/.test(addr) ? addr : null
}
