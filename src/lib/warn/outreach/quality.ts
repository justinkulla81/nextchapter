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
}

export interface Quality { ok: boolean; score: number; reason: string | null }

export function addressQuality(f: AddressFacts, now: Date = new Date()): Quality {
  const no = (reason: string): Quality => ({ ok: false, score: 0, reason })
  if (isRoleAddress(f.email)) return no('role address')
  if (f.mx === false) return no('domain has no mail server')
  if (f.domainBounced > 0 && f.domainDelivered === 0) return no('domain bounced before')
  if (!f.personId) return no('no verified contact')
  const fresh = !!f.hunterAt && now.getTime() - f.hunterAt.getTime() <= HUNTER_FRESH_DAYS * 86_400_000
  const hunterOk = f.primaryMatches && fresh && !!f.hunterStatus && HUNTER_OK.has(f.hunterStatus.toLowerCase())
  let score: number
  if (hunterOk) score = 10 + Math.max(0, Math.min(100, f.hunterScore ?? 0)) / 10
  else if (f.replied && f.domainBounced === 0) score = 8
  else return no('not verified deliverable')
  if (f.warmth === 'HOT') score += 3
  else if (f.warmth === 'WARM') score += 2
  if (f.replied) score += 3
  if (f.domainDelivered > 0 && f.domainBounced === 0) score += 1
  return { ok: true, score, reason: null }
}
