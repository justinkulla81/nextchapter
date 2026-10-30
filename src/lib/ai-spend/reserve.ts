import 'server-only'
import { prisma } from '@/lib/prisma'
import { allowByIp, DAY_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { capDecision, dayKey, limitsFromEnv, type Reservation } from './cap'

const SERVICE_DAY = 'free-ai-day'
const SERVICE_MONTH = 'free-ai-month'

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
 * Reserve one metered model call for a free tool. Returns ok only when the visitor, the day and the month are all under
 * their limits; the caller makes the call only then. Pass the returned release() to give the slot back if the call fails
 * before spending anything.
 */
export async function reserveFreeAiCall(tool: string): Promise<Reservation & { release?: () => Promise<void> }> {
  const limits = limitsFromEnv()
  if (!(await allowByIp(`free-ai-${tool}`, limits.perIpPerDay, DAY_MS))) {
    captureServerEvent(`free-ai-${crypto.randomUUID()}`, 'free_ai_cap_hit', { tool, reason: 'ip' })
    return { ok: false, reason: 'ip' }
  }
  const today = dayKey()
  const month = today.slice(0, 7)
  try {
    const [day, mon] = [await bump(SERVICE_DAY, today, 1), await bump(SERVICE_MONTH, month, 1)]
    const decision = capDecision({ day, month: mon }, limits)
    if (!decision.ok) {
      captureServerEvent(`free-ai-${crypto.randomUUID()}`, 'free_ai_cap_hit', { tool, reason: decision.reason, day, month: mon })
      // Not spent: give both slots back so a refused call does not push the count further past the cap.
      await Promise.allSettled([bump(SERVICE_DAY, today, -1), bump(SERVICE_MONTH, month, -1)])
      return decision
    }
    return {
      ok: true,
      release: async () => {
        await Promise.allSettled([bump(SERVICE_DAY, today, -1), bump(SERVICE_MONTH, month, -1)])
      },
    }
  } catch (error) {
    console.error('Free AI cap counter unavailable, refusing the call:', error)
    return { ok: false, reason: 'unavailable' }
  }
}
