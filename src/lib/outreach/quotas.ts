import 'server-only'
import { prisma } from '@/lib/prisma'
import { PERSON_GROUPS } from './person-groups'
import type { QuotaRule, TouchChannel } from './touch-stats'

export const QUOTA_CHANNELS: (TouchChannel | 'ALL')[] = ['ALL', 'email', 'call', 'linkedin', 'text']

/** Weekly targets, or null when the table is not there yet, so the page still renders. */
export async function loadQuotas(): Promise<QuotaRule[] | null> {
  try {
    const rows = await prisma.crmOutreachQuota.findMany({ orderBy: [{ groupKey: 'asc' }, { channel: 'asc' }] })
    return rows.flatMap((r) =>
      (r.groupKey === 'ALL' || (PERSON_GROUPS as string[]).includes(r.groupKey)) && (QUOTA_CHANNELS as string[]).includes(r.channel)
        ? [{ groupKey: r.groupKey as QuotaRule['groupKey'], channel: r.channel as QuotaRule['channel'], weeklyTarget: r.weeklyTarget }]
        : [])
  } catch {
    return null
  }
}
