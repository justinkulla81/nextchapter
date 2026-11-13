// How fast the layoff outreach may go out. Pure, so the rules are tested on their own. Owner, 2026-11-13: the sending domain is five weeks old
// and must not be spam filtered, so this is a trickle with a slow ramp, not a batch. These limits sit on top of the mailing tool's own hourly
// rate and daily cap, which every send still obeys.

/** Most layoff emails one five-minute run sends. */
export const LAYOFF_RUN_MAX = 2
/** One run in this share is skipped at random, so the sends do not land on a regular beat. */
export const LAYOFF_SKIP_SHARE = 0.25
/** Most layoff emails one recipient domain gets in 24 hours. */
export const LAYOFF_PER_DOMAIN_PER_DAY = 2
/** A second email to one domain waits this long after the first, so a bounce on the first (it comes back in seconds) stops the second. */
export const LAYOFF_DOMAIN_GAP_MINUTES = 30

/** Whether a domain may get a layoff email now: under its daily count, no bounce there in the last 24 hours, and the last one there long enough ago. */
export function domainMaySend(d: { sent: number; bounced: number; lastSentAt: Date | null } | undefined, now: Date): boolean {
  if (!d) return true
  if (d.bounced > 0 || d.sent >= LAYOFF_PER_DOMAIN_PER_DAY) return false
  return !d.lastSentAt || now.getTime() - d.lastSentAt.getTime() >= LAYOFF_DOMAIN_GAP_MINUTES * 60_000
}
/** Daily cap by how many earlier days the campaign has sent on: 40, 60, 80, 100, then 120. */
export const LAYOFF_RAMP = [40, 60, 80, 100, 120] as const

export const layoffDailyCap = (earlierSendDays: number): number => LAYOFF_RAMP[Math.max(0, Math.min(LAYOFF_RAMP.length - 1, earlierSendDays))]

/** Sending stops (for the next 24 hours) when this share of the last day's layoff emails bounced, or any was marked spam. */
export const LAYOFF_BREAKER_BOUNCE_SHARE = 0.03
export const LAYOFF_BREAKER_MIN_SENT = 20
export function layoffBreakerTripped(sent: number, bounced: number, complained: number): boolean {
  if (complained >= 1) return true
  return sent >= LAYOFF_BREAKER_MIN_SENT && bounced / sent >= LAYOFF_BREAKER_BOUNCE_SHARE
}

export const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? ''
