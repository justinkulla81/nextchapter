/**
 * Whether a list email may go to an address, from what Hunter last said about it (CrmPerson.emailVerifiedStatus).
 *
 * Owner decision (2026-11-23): 290 of 9,196 list emails bounced in 30 days (3.2%, over the ~2% where Gmail and Yahoo start
 * filing mail as spam). 143 of those addresses were already marked invalid by Hunter before the send, because the sender
 * skipped only "risky" ones, and 39 were never checked. Now:
 * - an address Hunter called anything but deliverable is never sent;
 * - a cold address (no warm signal, and every layoff outreach recipient) is checked with Hunter before its first send;
 * - a warm address that was never checked still goes (people the owner knows; the hourly verify cron covers them too).
 */
export type AddressVerdict = 'send' | 'skip' | 'verify'

const GOOD = new Set(['deliverable', 'valid'])

/** Every stored verdict that is not deliverable, for the roster's hold-back list (what is in CrmPerson today). */
export const NOT_DELIVERABLE = ['risky', 'invalid', 'undeliverable', 'disposable', 'unknown', 'accept_all'] as const

export function addressVerdict(status: string | null | undefined, cold: boolean): AddressVerdict {
  const s = (status ?? '').trim().toLowerCase()
  if (GOOD.has(s)) return 'send'
  if (s) return 'skip' // invalid, undeliverable, risky, disposable, accept_all, unknown...
  return cold ? 'verify' : 'send'
}

/** Most addresses checked with Hunter inside one send run (each check can take up to a minute); the rest wait for the next run. */
export const INLINE_VERIFY_PER_RUN = 8
