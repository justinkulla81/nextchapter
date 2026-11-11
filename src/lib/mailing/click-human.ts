import { isDatacenterIp } from '@/lib/http/datacenter-ip'
import { isCloudProviderIp } from '@/lib/http/cloud-provider-ip'
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

/** An address no person's browser connects from: private ranges, loopback and link-local (IPv4 and IPv6). */
export function isPrivateIp(ip: string | null): boolean {
  if (!ip) return false
  const v4 = ip.split('.').map(Number)
  if (v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
  }
  const lower = ip.toLowerCase()
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')
}

/** The network block an address sits in: its first three numbers for IPv4 (a /24), its first three groups for IPv6. */
export function ipBlock(ip: string | null): string | null {
  if (!ip) return null
  const parts = ip.includes(':') ? ip.split(':') : ip.split('.')
  return parts.length >= 3 ? parts.slice(0, 3).join(ip.includes(':') ? ':' : '.') : null
}

/** Why a click is not a person's, or null for a human click. */
export function botClickReason(click: ClickFacts, scannerIps: Set<string>, scannerBlocks: Set<string> = new Set()): string | null {
  if (click.ip && scannerIps.has(click.ip)) return 'address opened the links in emails to many different people'
  const block = ipBlock(click.ip)
  if (block && scannerBlocks.has(block)) return 'address block clicked emails to several different people'
  if (isPrivateIp(click.ip)) return 'address is a private network address'
  if (isDatacenterIp(click.ip)) return 'address is inside a cloud network'
  if (isCloudProviderIp(click.ip)) return 'address belongs to Amazon Web Services or Google Cloud'
  if (classifyUserAgent(click.userAgent) === 'bot') return 'browser identifies itself as a bot'
  if (click.deliveredAt && click.at.getTime() - click.deliveredAt.getTime() <= SCANNER_CLICK_WINDOW_MS) return 'clicked within two minutes of delivery'
  return null
}

export const isHumanClick = (click: ClickFacts, scannerIps: Set<string>, scannerBlocks: Set<string> = new Set()): boolean =>
  botClickReason(click, scannerIps, scannerBlocks) === null

// A scanner fans one email's links out over several addresses within moments (or hits one link twice in the same instant).
// A person clicks once, from one address. Two clicks on the same email from different addresses within a minute, or from one
// address within two seconds, are a scanner's, and so are the click that came first and the one that came after.
export const BURST_DIFFERENT_IP_MS = 60 * 1000
export const BURST_SAME_IP_MS = 2 * 1000

export interface ClickStamp {
  id: string
  ip: string | null
  at: Date
}

/** The ids of the clicks, all on one email, that are part of a scanner burst. */
export function burstClickIds(clicks: ClickStamp[]): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < clicks.length; i++) {
    for (let j = i + 1; j < clicks.length; j++) {
      const a = clicks[i]
      const b = clicks[j]
      const gap = Math.abs(a.at.getTime() - b.at.getTime())
      const sameIp = !!a.ip && a.ip === b.ip
      if ((sameIp && gap <= BURST_SAME_IP_MS) || (!sameIp && gap <= BURST_DIFFERENT_IP_MS)) {
        out.add(a.id)
        out.add(b.id)
      }
    }
  }
  return out
}
