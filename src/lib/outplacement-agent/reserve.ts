import 'server-only'
import { prisma } from '@/lib/prisma'
import { dayKey } from '@/lib/ai-spend/cap'
import { captureServerEvent } from '@/lib/posthog/server'
import { agentCapDecision, agentLimitsFromEnv, type AgentReservation } from './cap'

const SERVICE_DAY = 'outplacement-agent-day'
const SERVICE_MONTH = 'outplacement-agent-month'
const seatService = (seatId: string) => `outplacement-agent-seat:${seatId}`

async function bump(service: string, period: string, by: 1 | -1): Promise<number> {
  const row = await prisma.apiUsageCounter.upsert({
    where: { service_period: { service, period } },
    create: { service, period, count: Math.max(by, 0) },
    update: { count: { increment: by } },
    select: { count: true },
  })
  return row.count
}

/**
 * Reserve one metered model call for a seat's agent. The caller makes the call only when this returns ok; call release() to
 * give the slot back if the call fails before spending anything.
 */
export async function reserveAgentCall(seatId: string, task: string): Promise<AgentReservation & { release?: () => Promise<void> }> {
  const limits = agentLimitsFromEnv()
  const today = dayKey()
  const month = today.slice(0, 7)
  const undo = () => Promise.allSettled([bump(seatService(seatId), month, -1), bump(SERVICE_DAY, today, -1), bump(SERVICE_MONTH, month, -1)])
  try {
    const seatMonth = await bump(seatService(seatId), month, 1)
    const [day, mon] = [await bump(SERVICE_DAY, today, 1), await bump(SERVICE_MONTH, month, 1)]
    const decision = agentCapDecision({ seatMonth, day, month: mon }, limits)
    if (!decision.ok) {
      captureServerEvent(`outplacement-agent-${seatId}`, 'outplacement_agent_cap_hit', { seatId, task, reason: decision.reason, seatMonth, day, month: mon })
      await undo()
      return decision
    }
    return { ok: true, release: async () => void (await undo()) }
  } catch (error) {
    console.error('Outplacement agent cap counter unavailable, refusing the call:', error)
    return { ok: false, reason: 'unavailable' }
  }
}
