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

/** A click this soon after the send is a mail scanner following the link, not a person. */
export function isAutomatedClick(secondsAfterSend: number): boolean {
  return secondsAfterSend < 120
}

/** Adds one human open to an activity's outcome text: "..., human_opens 2". Opens within two minutes of the send are scanners and are not counted here. */
export function withHumanOpen(outcome: string | null): string {
  const o = outcome ?? ''
  const m = /, human_opens (\d+)/.exec(o)
  return m ? o.replace(/, human_opens \d+/, `, human_opens ${Number(m[1]) + 1}`) : `${o}, human_opens 1`
}

/** How many human opens an activity's outcome text records. */
export function humanOpens(outcome: string | null): number {
  const m = /, human_opens (\d+)/.exec(outcome ?? '')
  return m ? Number(m[1]) : 0
}
