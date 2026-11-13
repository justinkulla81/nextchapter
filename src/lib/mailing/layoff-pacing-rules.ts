// How fast the layoff outreach may go out. Pure, so the rules are tested on their own. Owner, 2026-11-13: the sending domain is five weeks old
// and must not be spam filtered, so this is a trickle with a slow ramp, not a batch. These limits sit on top of the mailing tool's own hourly
// rate and daily cap, which every send still obeys.

/** Most layoff emails one five-minute run sends. */
export const LAYOFF_RUN_MAX = 2
/** One run in this share is skipped at random, so the sends do not land on a regular beat. */
export const LAYOFF_SKIP_SHARE = 0.25
/** Most layoff emails one recipient domain gets in 24 hours. */
export const LAYOFF_PER_DOMAIN_PER_DAY = 2
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
