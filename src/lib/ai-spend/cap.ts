// The spend cap for the free AI tools (résumé bullet rewriter, interview answer coach). Every metered model call on a public,
// no-account page goes through reserveFreeAiCall() first; a call that is not reserved is never made.
//
// Three limits, all counted in calls (the tools use one small, fixed-size call each, so calls track dollars):
//   - per visitor address per day, so one person cannot drain the day;
//   - sitewide per day, the hard daily ceiling;
//   - sitewide per month, a backstop if the daily ceiling is raised.
// The counters live in ApiUsageCounter (one row per service and period), so no new table. If the counter cannot be read the
// call is refused (fail closed): a database problem must never turn into an open tap.
//
// Defaults are set so the worst day costs a couple of dollars. Change them with FREE_AI_DAILY_CALLS, FREE_AI_MONTHLY_CALLS and
// FREE_AI_PER_IP_PER_DAY in the environment.

export interface FreeAiLimits {
  dailyCalls: number
  monthlyCalls: number
  perIpPerDay: number
}

export const DEFAULT_LIMITS: FreeAiLimits = { dailyCalls: 400, monthlyCalls: 8000, perIpPerDay: 6 }

const positiveInt = (v: string | undefined, fallback: number): number => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function limitsFromEnv(env: Record<string, string | undefined> = process.env): FreeAiLimits {
  return {
    dailyCalls: positiveInt(env.FREE_AI_DAILY_CALLS, DEFAULT_LIMITS.dailyCalls),
    monthlyCalls: positiveInt(env.FREE_AI_MONTHLY_CALLS, DEFAULT_LIMITS.monthlyCalls),
    perIpPerDay: positiveInt(env.FREE_AI_PER_IP_PER_DAY, DEFAULT_LIMITS.perIpPerDay),
  }
}

export type CapReason = 'ip' | 'daily' | 'monthly' | 'unavailable'
export type Reservation = { ok: true } | { ok: false; reason: CapReason }

/** The decision once the counters have been incremented: counts include this call. Pure, so it is tested without a database. */
export function capDecision(counts: { day: number; month: number }, limits: FreeAiLimits): Reservation {
  if (counts.day > limits.dailyCalls) return { ok: false, reason: 'daily' }
  if (counts.month > limits.monthlyCalls) return { ok: false, reason: 'monthly' }
  return { ok: true }
}

/** What the visitor is told when a call is not made. Says what happened and what to do next. */
export const CAP_MESSAGE: Record<CapReason, string> = {
  ip: 'You have used the free tries for today. Come back tomorrow, or start a free assessment to keep going.',
  daily: 'The free AI tools have reached today’s limit. They reset tomorrow. The résumé check and AI job check still work.',
  monthly: 'The free AI tools have reached this month’s limit. The résumé check and AI job check still work.',
  unavailable: 'The free AI tools are not available right now. Try again in a few minutes.',
}

/** Calendar day (YYYY-MM-DD) in New York, the same day boundary the daily emails use. */
export const dayKey = (now = new Date()): string => now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
