/**
 * Who is safe to email about a layoff. Pure (no database, no network), so the rules are tested on their own.
 *
 * Owner, 2026-11-13: the sending domain must not be spam filtered, so send to fewer people, the ones most likely to be real. The evidence
 * (2026-11-13): of the first 56 layoff emails, the only two bounces were job-center directory addresses with no verified contact behind
 * them; every contact Hunter had marked deliverable was delivered. So an address is emailed only when it belongs to a CRM contact whose
 * address Hunter marked deliverable, recently, or who has replied to us; never a role address (info@, jobs@), never a domain that has
 * bounced for us and never delivered, never a domain with no mail server.
 *
 * Owner, 2026-11-13 ("so many bounces, I need way better verification"): of the first 65, four bounced. Two were unverified directory
 * addresses (sent before the gate above shipped). Two were Hunter-verified (score 100, two days old) at one domain whose mail gateway
 * started refusing us, though 12 earlier emails there were delivered. Hunter cannot see that, so a domain that bounced us in the last
 * 30 days is held until an email there is delivered cleanly again, and a Hunter check counts for 90 days, not 180 (people change jobs).
 * A bounce is never counted as a delivery (Resend reports both for most bounces).
 */

export const HUNTER_OK = new Set(['deliverable', 'valid'])

/**
 * Why a verification run stopped for good (no credits left above the margin, the day's ceiling, Hunter down or not configured), as opposed to
 * stopping for now (the per-run cap, the time budget). When it stopped for good there is no point waiting for an answer: the layoff is drafted
 * and scheduled with the addresses already verified, and the rest are simply not emailed.
 */
export const isVerifyBlocked = (stopped: string) => ['floor', 'daily', 'hunter_error', 'not_configured'].includes(stopped)
/** A Hunter check older than this is treated as no check. */
export const HUNTER_FRESH_DAYS = 90
/** A domain that bounced one of our emails this recently is held until a later email there is delivered cleanly. */
export const DOMAIN_BOUNCE_HOLD_DAYS = 30

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
  /** What our own sends to this domain have done: delivered cleanly (a bounced email is never a delivery) and bounced (including addresses suppressed after a bounce). */
  domainDelivered: number
  domainBounced: number
  /** The domain's latest bounce, and its latest clean delivery; null when there is none. */
  domainLastBounceAt?: Date | null
  domainLastCleanAt?: Date | null
  /** The domain has a mail server; null when the lookup was inconclusive. */
  mx: boolean | null
  /** A saved Hunter check of this address itself (AddressVerification), whoever it belongs to; null when never checked. */
  directory: { status: string; score: number | null; at: Date } | null
}

export interface Quality { ok: boolean; score: number; reason: string | null }

const isFresh = (at: Date | null | undefined, now: Date) => !!at && now.getTime() - at.getTime() <= HUNTER_FRESH_DAYS * 86_400_000
/** A directory address has nothing else vouching for it, so Hunter must call it deliverable with a high score. */
export const DIRECTORY_MIN_SCORE = 90

/** The domain refused one of our emails within DOMAIN_BOUNCE_HOLD_DAYS and nothing has been delivered there cleanly since. */
export function domainBouncingNow(f: Pick<AddressFacts, 'domainLastBounceAt' | 'domainLastCleanAt'>, now: Date = new Date()): boolean {
  const b = f.domainLastBounceAt
  if (!b || now.getTime() - b.getTime() > DOMAIN_BOUNCE_HOLD_DAYS * 86_400_000) return false
  return !f.domainLastCleanAt || f.domainLastCleanAt.getTime() <= b.getTime()
}

/** Shared mail providers: one person's bounce there says nothing about anyone else's address, so the domain rules skip them. */
const WEBMAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'comcast.net', 'proton.me', 'protonmail.com'])
export const isWebmail = (email: string) => WEBMAIL.has(email.trim().toLowerCase().split('@')[1] ?? '')

/** The rules that stop an address whatever Hunter says; null when none applies. */
function hardStop(f: AddressFacts, now: Date): string | null {
  if (isRoleAddress(f.email)) return 'role address'
  if (f.mx === false) return 'domain has no mail server'
  if (isWebmail(f.email)) return null
  if (f.domainBounced > 0 && f.domainDelivered === 0) return 'domain bounced before'
  if (domainBouncingNow(f, now)) return 'domain bounced recently'
  return null
}

export function addressQuality(f: AddressFacts, now: Date = new Date()): Quality {
  const no = (reason: string): Quality => ({ ok: false, score: 0, reason })
  const stop = hardStop(f, now)
  if (stop) return no(stop)
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
  if (hardStop(f, now)) return false
  if (f.replied && f.personId) return false
  if (f.directory && isFresh(f.directory.at, now)) return false
  if (f.personId && f.primaryMatches && f.hunterStatus && isFresh(f.hunterAt, now)) return false
  return true
}
