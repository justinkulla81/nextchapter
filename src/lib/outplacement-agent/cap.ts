// The spend cap for the paid outplacement agent. Separate from the free-tool cap (src/lib/ai-spend): a free visitor can never use
// up a paying seat's calls, and a seat can never drain the free tools. Counted in calls, because the agent uses a few small,
// fixed-size model calls a week per seat (cost model: docs/OUTPLACEMENT_AGENT.md).
//
// Three limits:
//   - per seat per month: the hard per-seat cap, so one person's cost is bounded whatever they do;
//   - agent-wide per day and per month: the ceiling if many seats are switched on at once.
// If a counter cannot be read the call is refused (fail closed).
//
// Change with OUTPLACEMENT_AGENT_SEAT_MONTHLY_CALLS, OUTPLACEMENT_AGENT_DAILY_CALLS and OUTPLACEMENT_AGENT_MONTHLY_CALLS.

export interface AgentLimits {
  seatMonthlyCalls: number
  dailyCalls: number
  monthlyCalls: number
}

// 5 drafts a week is about 22 a month; 30 leaves room for a retry or a fifth week, and nothing more.
export const DEFAULT_AGENT_LIMITS: AgentLimits = { seatMonthlyCalls: 30, dailyCalls: 300, monthlyCalls: 4000 }

const positiveInt = (v: string | undefined, fallback: number): number => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function agentLimitsFromEnv(env: Record<string, string | undefined> = process.env): AgentLimits {
  return {
    seatMonthlyCalls: positiveInt(env.OUTPLACEMENT_AGENT_SEAT_MONTHLY_CALLS, DEFAULT_AGENT_LIMITS.seatMonthlyCalls),
    dailyCalls: positiveInt(env.OUTPLACEMENT_AGENT_DAILY_CALLS, DEFAULT_AGENT_LIMITS.dailyCalls),
    monthlyCalls: positiveInt(env.OUTPLACEMENT_AGENT_MONTHLY_CALLS, DEFAULT_AGENT_LIMITS.monthlyCalls),
  }
}

export type AgentCapReason = 'seat' | 'daily' | 'monthly' | 'unavailable'
export type AgentReservation = { ok: true } | { ok: false; reason: AgentCapReason }

/** The decision once the counters have been incremented: counts include this call. Pure, so it is tested without a database. */
export function agentCapDecision(counts: { seatMonth: number; day: number; month: number }, limits: AgentLimits): AgentReservation {
  if (counts.seatMonth > limits.seatMonthlyCalls) return { ok: false, reason: 'seat' }
  if (counts.day > limits.dailyCalls) return { ok: false, reason: 'daily' }
  if (counts.month > limits.monthlyCalls) return { ok: false, reason: 'monthly' }
  return { ok: true }
}
