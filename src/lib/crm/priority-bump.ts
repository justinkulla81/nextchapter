import type { CrmPriorityTier } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

/**
 * Anyone who is actually emailing with you is at least P1, and anyone you
 * are emailing a lot with is P0.
 *
 * "Emailing with" means a real exchange: at least one message from them and
 * one from you. Outbound-only is outreach nobody has answered, which is what
 * priority is meant to rank in the first place, not evidence of a
 * relationship. "A lot" is LOTS_OF_EMAIL messages inside RECENT_DAYS.
 *
 * The rule only ever raises. And it never fights you: after it has bumped
 * someone, a priority you set by hand later (priorityManualAt after
 * priorityAutoAt) stands, so moving P0 to P1 or P1 to P2 sticks.
 */
export const RECENT_DAYS = 30
export const LOTS_OF_EMAIL = 5

const RANK: Record<CrmPriorityTier, number> = { P0: 0, P1: 1, P2: 2 }

export interface EmailStats { inbound: number; outbound: number; recent: number }

export function emailPriorityFloor(s: EmailStats): CrmPriorityTier | null {
  if (s.inbound === 0 || s.outbound === 0) return null
  return s.recent >= LOTS_OF_EMAIL ? 'P0' : 'P1'
}

export function nextAutoPriority(p: {
  priority: CrmPriorityTier | null
  priorityAutoAt: Date | null
  priorityManualAt: Date | null
  floor: CrmPriorityTier | null
}): CrmPriorityTier | null {
  if (!p.floor) return null
  // A hand-set value after our last bump is a decision; leave it.
  if (p.priorityAutoAt && p.priorityManualAt && p.priorityManualAt > p.priorityAutoAt) return null
  if (p.priority && RANK[p.priority] <= RANK[p.floor]) return null
  return p.floor
}

/** Raises priority for the given people where the email rule says to. Returns how many changed. */
export async function applyEmailPriorityBumps(personIds: string[], now = new Date()): Promise<number> {
  const ids = [...new Set(personIds)]
  let changed = 0
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000)

  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const where = { personId: { in: chunk }, type: 'EMAIL' as const, needsReview: false }
    const [byDir, recent, people] = await Promise.all([
      prisma.crmActivity.groupBy({ by: ['personId', 'direction'], where, _count: { _all: true } }),
      prisma.crmActivity.groupBy({ by: ['personId'], where: { ...where, occurredAt: { gte: since } }, _count: { _all: true } }),
      prisma.crmPerson.findMany({
        where: { id: { in: chunk }, deletedAt: null },
        select: { id: true, priority: true, priorityAutoAt: true, priorityManualAt: true },
      }),
    ])
    const stats = new Map<string, EmailStats>()
    for (const r of byDir) {
      if (!r.personId) continue
      const s = stats.get(r.personId) ?? { inbound: 0, outbound: 0, recent: 0 }
      if (r.direction === 'INBOUND') s.inbound = r._count._all
      if (r.direction === 'OUTBOUND') s.outbound = r._count._all
      stats.set(r.personId, s)
    }
    for (const r of recent) {
      if (r.personId && stats.has(r.personId)) stats.get(r.personId)!.recent = r._count._all
    }

    for (const p of people) {
      const s = stats.get(p.id)
      if (!s) continue
      const next = nextAutoPriority({ ...p, floor: emailPriorityFloor(s) })
      if (!next) continue
      await prisma.$transaction([
        prisma.crmPerson.update({ where: { id: p.id }, data: { priority: next, priorityAutoAt: now } }),
        prisma.crmActivity.create({
          data: {
            type: 'FIELD_CHANGED', direction: 'INTERNAL', personId: p.id,
            subject: 'priority changed',
            body: `priority: ${p.priority ?? 'none'} → ${next} (automatic: ${s.inbound} from them, ${s.outbound} from you by email)`,
          },
        }),
      ])
      captureServerEvent('system', 'crm_priority_auto_bumped', { personId: p.id, from: p.priority, to: next })
      changed++
    }
  }
  return changed
}
