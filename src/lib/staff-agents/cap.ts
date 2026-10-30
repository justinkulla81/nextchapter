// The spend cap for the staff agents. Separate from the free-tool cap (src/lib/ai-spend) and the seat agent's cap
// (src/lib/outplacement-agent), so none of the three can use up another's calls. Counted in calls: each agent task is one
// small, fixed-size model call. Fails closed if a counter cannot be read.
//
// Change with STAFF_AGENTS_ORG_MONTHLY_CALLS, STAFF_AGENTS_DAILY_CALLS and STAFF_AGENTS_MONTHLY_CALLS.

export interface StaffAgentLimits { orgMonthlyCalls: number; dailyCalls: number; monthlyCalls: number }

export const DEFAULT_STAFF_LIMITS: StaffAgentLimits = { orgMonthlyCalls: 60, dailyCalls: 150, monthlyCalls: 2500 }

const positiveInt = (v: string | undefined, fallback: number): number => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function staffLimitsFromEnv(env: Record<string, string | undefined> = process.env): StaffAgentLimits {
  return {
    orgMonthlyCalls: positiveInt(env.STAFF_AGENTS_ORG_MONTHLY_CALLS, DEFAULT_STAFF_LIMITS.orgMonthlyCalls),
    dailyCalls: positiveInt(env.STAFF_AGENTS_DAILY_CALLS, DEFAULT_STAFF_LIMITS.dailyCalls),
    monthlyCalls: positiveInt(env.STAFF_AGENTS_MONTHLY_CALLS, DEFAULT_STAFF_LIMITS.monthlyCalls),
  }
}

export type StaffCapReason = 'org' | 'daily' | 'monthly' | 'unavailable'
export type StaffReservation = { ok: true } | { ok: false; reason: StaffCapReason }

/** The decision once the counters have been incremented: counts include this call. Pure. */
export function staffCapDecision(counts: { orgMonth: number; day: number; month: number }, limits: StaffAgentLimits): StaffReservation {
  if (counts.orgMonth > limits.orgMonthlyCalls) return { ok: false, reason: 'org' }
  if (counts.day > limits.dailyCalls) return { ok: false, reason: 'daily' }
  if (counts.month > limits.monthlyCalls) return { ok: false, reason: 'monthly' }
  return { ok: true }
}
