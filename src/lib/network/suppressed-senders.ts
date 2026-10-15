import 'server-only'
import { prisma } from '@/lib/prisma'
import { extractEmailAddress } from '@/lib/email-tracking/email-address'
export { SUPPRESSED_SENDER_REASONS } from './suppressed-sender-reasons'
import { NON_COMPANY_DOMAINS } from '@/lib/text/email-domain'

export interface SuppressionSet {
  addresses: Set<string>
  domains: Set<string>
}

export const EMPTY_SUPPRESSION: SuppressionSet = { addresses: new Set(), domains: new Set() }

// Fails soft: until prisma/manual/2026-10-13-suppressed-sender.sql is applied
// the table doesn't exist, and a missing table must never break sync or the
// follow-up lists.
export async function loadSuppression(candidateId: string): Promise<SuppressionSet> {
  try {
    const rows = await prisma.suppressedSender.findMany({
      where: { candidateId },
      select: { value: true, isDomain: true },
    })
    return {
      addresses: new Set(rows.filter((r) => !r.isDomain).map((r) => r.value)),
      domains: new Set(rows.filter((r) => r.isDomain).map((r) => r.value)),
    }
  } catch {
    return EMPTY_SUPPRESSION
  }
}

function bareAddress(raw: string): string {
  return extractEmailAddress(raw).trim().toLowerCase()
}

export function isSuppressed(set: SuppressionSet, rawAddress: string | null | undefined): boolean {
  if (!rawAddress) return false
  const address = bareAddress(rawAddress)
  if (set.addresses.has(address)) return true
  const domain = address.split('@')[1]
  if (!domain) return false
  // "mail.pta.org" is blocked by a saved "pta.org".
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (set.domains.has(parts.slice(i).join('.'))) return true
  }
  return false
}

// What gets stored for a flagged sender. A consumer mailbox provider
// (gmail.com, outlook.com...) is never blocked as a domain — that would hide
// every friend and recruiter using one — so those always fall back to the
// single address.
export function suppressionTarget(
  rawAddress: string,
  scope: 'address' | 'domain'
): { value: string; isDomain: boolean } | null {
  const address = bareAddress(rawAddress)
  const domain = address.split('@')[1]
  if (!address.includes('@') || !domain) return null
  if (scope === 'domain' && !NON_COMPANY_DOMAINS.has(domain.split('.').slice(-2).join('.'))) {
    return { value: domain, isDomain: true }
  }
  return { value: address, isDomain: false }
}

// Senders that are very probably not a job-search contact, judged from the
// address alone. Deliberately conservative — used to keep these senders out
// of the *auto-added contacts and follow-up nudges*, never to hide mail the
// candidate might care about from the activity tracker. Anything it misses is
// caught by the per-sender "not job-related" buttons.
const NON_WORK_LOCAL_PART = /^(no-?reply|do-?not-?reply|donotreply|notifications?|newsletter|news|marketing|promo(tion)?s?|offers|deals|billing|receipts?|orders?|support|alerts?|updates?|mailer|bounce|digest)\b/i
const NON_WORK_DOMAIN =
  /(^|\.)(k12\.[a-z]{2}\.us|k12\.[a-z]{2}|pta\.org|parentsquare\.com|classdojo\.com|remind\.com|schoology\.com|powerschool\.com|schoolmessenger\.com|teamsnap\.com|sportsengine\.com|signupgenius\.com|constantcontact\.com|mailchimp\.com|substack\.com|eventbrite\.com|meetup\.com|nextdoor\.com|facebookmail\.com|e\.[a-z0-9-]+\.[a-z]+|em\.[a-z0-9-]+\.[a-z]+)$/i

export function looksLikeNonWorkSender(rawAddress: string): boolean {
  const address = bareAddress(rawAddress)
  const [local, domain] = address.split('@')
  if (!local || !domain) return false
  return NON_WORK_LOCAL_PART.test(local) || NON_WORK_DOMAIN.test(domain)
}
