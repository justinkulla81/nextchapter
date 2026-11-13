/**
 * Who is safe to email about a layoff. Pure (no database, no network), so the rules are tested on their own.
 *
 * Owner, 2026-11-13: the sending domain must not be spam filtered, so send to fewer people, the ones most likely to be real. The evidence
 * (2026-11-13): of the first 56 layoff emails, the only two bounces were job-center directory addresses with no verified contact behind
 * them; every contact Hunter had marked deliverable was delivered. So an address is emailed only when it belongs to a CRM contact whose
 * address Hunter marked deliverable, recently, or who has replied to us; never a role address (info@, jobs@), never a domain that has
 * bounced for us and never delivered, never a domain with no mail server.
 */

export const HUNTER_OK = new Set(['deliverable', 'valid'])
/** A Hunter check older than this is treated as no check. */
export const HUNTER_FRESH_DAYS = 180

const ROLE_LOCALS = new Set([
  'info', 'information', 'contact', 'contactus', 'hello', 'hi', 'support', 'help', 'admin', 'administrator', 'office', 'team', 'jobs', 'job', 'careers',
  'career', 'hr', 'humanresources', 'recruiting', 'recruitment', 'recruiter', 'talent', 'sales', 'marketing', 'service', 'services', 'webmaster',
  'general', 'inquiries', 'enquiries', 'mail', 'noreply', 'no-reply', 'donotreply', 'reception', 'customerservice', 'feedback', 'press', 'media',
  'billing', 'accounts', 'payroll', 'benefits', 'events', 'news', 'communications', 'rapidresponse', 'workforce', 'employment',
])

export const localPart = (email: string) => email.trim().toLowerCase().split('@')[0] ?? ''
export const isRoleAddress = (email: string) => ROLE_LOCALS.has(localPart(email).replace(/[._-]/g, '')) || ROLE_LOCALS.has(localPart(email))

export interface AddressFacts {
  email: string
  /** The CRM contact the address belongs to; null for a directory entry (a job center's shared address). */
  personId: string | null
  hunterStatus: string | null
  hunterScore: number | null
  hunterAt: Date | null
  /** The address Hunter checked is this one (a person can have several). */
  primaryMatches: boolean
  warmth: string | null
  /** The contact has replied to us before. */
  replied: boolean
  /** What our own sends to this domain have done: delivered and bounced (including addresses suppressed after a bounce). */
  domainDelivered: number
  domainBounced: number
  /** The domain has a mail server; null when the lookup was inconclusive. */
  mx: boolean | null
  /** A saved Hunter check of this address itself (AddressVerification), whoever it belongs to; null when never checked. */
  directory: { status: string; score: number | null; at: Date } | null
}

export interface Quality { ok: boolean; score: number; reason: string | null }

const isFresh = (at: Date | null | undefined, now: Date) => !!at && now.getTime() - at.getTime() <= HUNTER_FRESH_DAYS * 86_400_000
/** A directory address has nothing else vouching for it, so Hunter must call it deliverable with a high score. */
export const DIRECTORY_MIN_SCORE = 90

export function addressQuality(f: AddressFacts, now: Date = new Date()): Quality {
  const no = (reason: string): Quality => ({ ok: false, score: 0, reason })
  if (isRoleAddress(f.email)) return no('role address')
  if (f.mx === false) return no('domain has no mail server')
  if (f.domainBounced > 0 && f.domainDelivered === 0) return no('domain bounced before')
  const personOk = !!f.personId && f.primaryMatches && isFresh(f.hunterAt, now) && !!f.hunterStatus && HUNTER_OK.has(f.hunterStatus.toLowerCase())
  const dirOk = !!f.directory && f.directory.status === 'deliverable' && (f.directory.score ?? 0) >= DIRECTORY_MIN_SCORE && isFresh(f.directory.at, now)
  let score: number
  if (personOk) score = 10 + Math.max(0, Math.min(100, f.hunterScore ?? 0)) / 10
  else if (dirOk) score = 10 + Math.max(0, Math.min(100, f.directory!.score ?? 0)) / 10
  else if (f.replied && !!f.personId && f.domainBounced === 0) score = 8
  else return no(f.personId || f.directory ? 'not verified deliverable' : 'no verified contact')
  if (f.warmth === 'HOT') score += 3
  else if (f.warmth === 'WARM') score += 2
  if (f.replied) score += 3
  if (f.domainDelivered > 0 && f.domainBounced === 0) score += 1
  return { ok: true, score, reason: null }
}

/**
 * Whether it is worth spending a Hunter credit on this address: it passes every other rule, and nothing has checked it recently (no fresh Hunter
 * status on the contact, no saved check of the address). An address Hunter already called risky or invalid is not checked again.
 */
export function needsVerification(f: AddressFacts, now: Date = new Date()): boolean {
  if (isRoleAddress(f.email) || f.mx === false || (f.domainBounced > 0 && f.domainDelivered === 0)) return false
  if (f.replied && f.personId) return false
  if (f.directory && isFresh(f.directory.at, now)) return false
  if (f.personId && f.primaryMatches && f.hunterStatus && isFresh(f.hunterAt, now)) return false
  return true
}
