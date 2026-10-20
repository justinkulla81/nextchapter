import 'server-only'
import { prisma } from '@/lib/prisma'
import { engagementState, type EngagementState } from '@/lib/email/engagement-state'

/**
 * Engagement state for each member id. Last activity is the latest of login,
 * page activity and check-in, falling back to when they registered, so a
 * member who never came back after signing up counts as quiet from day one.
 */
export async function loadEngagementStates(ids: string[], now = new Date()): Promise<Map<string, EngagementState>> {
  const out = new Map<string, EngagementState>()
  if (ids.length === 0) return out
  const [profiles, logins, pages] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { id: { in: ids } },
      select: { id: true, createdAt: true, registrationCompletedAt: true, lastCheckInAt: true },
    }),
    prisma.candidateLoginEvent.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids } }, _max: { createdAt: true } }),
    prisma.candidatePageActivityEvent.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids } }, _max: { createdAt: true } }),
  ])
  const last = new Map<string, Date>()
  const bump = (id: string, at: Date | null | undefined) => {
    if (at && (!last.get(id) || at > last.get(id)!)) last.set(id, at)
  }
  for (const p of profiles) {
    bump(p.id, p.registrationCompletedAt ?? p.createdAt)
    bump(p.id, p.lastCheckInAt)
  }
  for (const r of logins) bump(r.candidateId, r._max.createdAt)
  for (const r of pages) bump(r.candidateId, r._max.createdAt)
  for (const id of ids) {
    const at = last.get(id)
    // No profile row found: leave the member alone rather than silencing them.
    out.set(id, at ? engagementState(at, now) : 'active')
  }
  return out
}
