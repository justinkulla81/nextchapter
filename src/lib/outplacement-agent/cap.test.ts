import { describe, expect, it } from 'vitest'
import { agentCapDecision, agentLimitsFromEnv, DEFAULT_AGENT_LIMITS } from './cap'
import { isOutplacementAgentOn } from './switch'

const limits = { seatMonthlyCalls: 30, dailyCalls: 300, monthlyCalls: 4000 }

describe('agentCapDecision', () => {
  it('allows a call at the limit and refuses the one past it', () => {
    expect(agentCapDecision({ seatMonth: 30, day: 10, month: 10 }, limits)).toEqual({ ok: true })
    expect(agentCapDecision({ seatMonth: 31, day: 10, month: 10 }, limits)).toEqual({ ok: false, reason: 'seat' })
  })
  it('refuses on the agent-wide day and month ceilings', () => {
    expect(agentCapDecision({ seatMonth: 1, day: 301, month: 10 }, limits)).toEqual({ ok: false, reason: 'daily' })
    expect(agentCapDecision({ seatMonth: 1, day: 1, month: 4001 }, limits)).toEqual({ ok: false, reason: 'monthly' })
  })
  it('reports the seat cap first, so one seat is named before the pool', () => {
    expect(agentCapDecision({ seatMonth: 99, day: 999, month: 9999 }, limits)).toEqual({ ok: false, reason: 'seat' })
  })
})

describe('agentLimitsFromEnv', () => {
  it('uses defaults for missing or bad values', () => {
    expect(agentLimitsFromEnv({})).toEqual(DEFAULT_AGENT_LIMITS)
    expect(agentLimitsFromEnv({ OUTPLACEMENT_AGENT_SEAT_MONTHLY_CALLS: 'abc', OUTPLACEMENT_AGENT_DAILY_CALLS: '-4' })).toEqual(DEFAULT_AGENT_LIMITS)
  })
  it('reads overrides', () => {
    expect(agentLimitsFromEnv({ OUTPLACEMENT_AGENT_SEAT_MONTHLY_CALLS: '12' }).seatMonthlyCalls).toBe(12)
  })
})

describe('isOutplacementAgentOn', () => {
  it('is off unless explicitly on', () => {
    expect(isOutplacementAgentOn({})).toBe(false)
    expect(isOutplacementAgentOn({ OUTPLACEMENT_AGENT_ENABLED: 'true' })).toBe(false)
    expect(isOutplacementAgentOn({ OUTPLACEMENT_AGENT_ENABLED: ' ON ' })).toBe(true)
  })
})
