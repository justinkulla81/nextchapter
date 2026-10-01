import 'server-only'
import { prisma } from '@/lib/prisma'
import { isMissingPermission, isRateLimited } from '@/lib/google/error-reason'

const SOURCES = { Gmail: ['gmail', 'gmail-manual'], Calendar: ['calendar', 'calendar-manual'] } as const

export interface CrmSyncHealth {
  /** Which sweeps' latest run failed, and since when (first failure after the last success). */
  failing: { label: 'Gmail' | 'Calendar'; since: Date; error: string }[]
  /**
   * Only reconnecting fixes it: nothing connected, access expired, or a grant
   * missing the Gmail/Calendar permission. A rate limit or Google being down
   * isn't — waiting (and Sync now) is the fix for those.
   */
  needsReconnect: boolean
  reason: 'not_connected' | 'permission' | 'expired' | 'unavailable' | 'partial' | null
}

/**
 * The error a sweep records when it ran but Gmail refused a few messages.
 * Not an outage: everything else in the window was read and logged, so the
 * alert must not say mail has stopped reaching the CRM.
 */
export function isPartialRun(error: string): boolean {
  return /^\d+ of \d+ messages could not be fetched/.test(error)
}

export async function getCrmSyncHealth(): Promise<CrmSyncHealth> {
  const [inbox, calendar] = await Promise.all([
    prisma.googleInboxConnection.findFirst({ select: { id: true } }),
    prisma.adminGoogleCalendarConnection.findFirst({ select: { id: true } }),
  ])

  const failing: CrmSyncHealth['failing'] = []
  for (const [label, sources] of Object.entries(SOURCES) as [keyof typeof SOURCES, readonly string[]][]) {
    const latest = await prisma.crmSyncRun.findFirst({
      where: { source: { in: [...sources] }, finishedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      select: { error: true },
    })
    if (!latest?.error) continue
    const lastOk = await prisma.crmSyncRun.findFirst({
      where: { source: { in: [...sources] }, finishedAt: { not: null }, error: null },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    })
    const firstFail = await prisma.crmSyncRun.findFirst({
      where: { source: { in: [...sources] }, error: { not: null }, ...(lastOk ? { startedAt: { gt: lastOk.startedAt } } : {}) },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    })
    failing.push({ label, since: firstFail?.startedAt ?? new Date(), error: latest.error })
  }

  const errors = failing.map((f) => f.error)
  const reason: CrmSyncHealth['reason'] = !inbox || !calendar
    ? 'not_connected'
    : errors.some((e) => e.includes('invalid_grant'))
      ? 'expired'
      : errors.some((e) => isMissingPermission(e) || (/\b403\b/.test(e) && !isRateLimited(e)))
        ? 'permission'
        : failing.length === 0 ? null
          : errors.every(isPartialRun) ? 'partial' : 'unavailable'
  return { failing, reason, needsReconnect: reason === 'not_connected' || reason === 'expired' || reason === 'permission' }
}
