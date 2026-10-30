import 'server-only'
import { prisma } from '@/lib/prisma'
import { dayKey } from '@/lib/ai-spend/cap'
import { captureServerEvent } from '@/lib/posthog/server'
import { staffCapDecision, staffLimitsFromEnv, type StaffReservation } from './cap'

const SERVICE_DAY = 'staff-agents-day'
const SERVICE_MONTH = 'staff-agents-month'
const orgService = (institutionId: string) => `staff-agents-org:${institutionId}`

async function bump(service: string, period: string, by: 1 | -1): Promise<number> {
  const row = await prisma.apiUsageCounter.upsert({
    where: { service_period: { service, period } },
    create: { service, period, count: Math.max(by, 0) },
    update: { count: { increment: by } },
    select: { count: true },
  })
  return row.count
}

/** Reserve one metered call for an organization's agent; call release() to give the slot back if the call fails before spending. */
export async function reserveStaffAgentCall(institutionId: string, agent: string): Promise<StaffReservation & { release?: () => Promise<void> }> {
  const limits = staffLimitsFromEnv()
  const today = dayKey()
  const month = today.slice(0, 7)
  const undo = () => Promise.allSettled([bump(orgService(institutionId), month, -1), bump(SERVICE_DAY, today, -1), bump(SERVICE_MONTH, month, -1)])
  try {
    const orgMonth = await bump(orgService(institutionId), month, 1)
    const [day, mon] = [await bump(SERVICE_DAY, today, 1), await bump(SERVICE_MONTH, month, 1)]
    const decision = staffCapDecision({ orgMonth, day, month: mon }, limits)
    if (!decision.ok) {
      captureServerEvent(`staff-agent-${institutionId}`, 'staff_agent_cap_hit', { institutionId, agent, reason: decision.reason, orgMonth, day, month: mon })
      await undo()
      return decision
    }
    return { ok: true, release: async () => void (await undo()) }
  } catch (error) {
    console.error('Staff agent cap counter unavailable, refusing the call:', error)
    return { ok: false, reason: 'unavailable' }
  }
}
