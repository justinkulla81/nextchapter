import { isDatacenterIp } from '@/lib/http/datacenter-ip'
import { classifyUserAgent } from '@/lib/http/user-agent'

// Mail-security scanners click every link in a message within moments of delivery, from a cloud network, so Resend reports a
// "click" that no person made. Only a human click counts as a click: it sets clickedAt and the click counts, and it is what
// the visitor log matches a later visit to.
export const SCANNER_CLICK_WINDOW_MS = 2 * 60 * 1000

export interface ClickFacts {
  ip: string | null
  userAgent: string | null
  at: Date
  /** When the email reached the recipient's mail server, if Resend has said so. */
  deliveredAt: Date | null
}

/** Why a click is not a person's, or null for a human click. */
export function botClickReason(click: ClickFacts, scannerIps: Set<string>): string | null {
  if (click.ip && scannerIps.has(click.ip)) return 'address opened the links in emails to many different people'
  if (isDatacenterIp(click.ip)) return 'address is inside a cloud network'
  if (classifyUserAgent(click.userAgent) === 'bot') return 'browser identifies itself as a bot'
  if (click.deliveredAt && click.at.getTime() - click.deliveredAt.getTime() <= SCANNER_CLICK_WINDOW_MS) return 'clicked within two minutes of delivery'
  return null
}

export const isHumanClick = (click: ClickFacts, scannerIps: Set<string>): boolean => botClickReason(click, scannerIps) === null
