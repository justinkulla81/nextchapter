import 'server-only'
import { prisma } from '@/lib/prisma'

export interface ReconnectStatus {
  needsGmailReconnect: boolean
  needsCalendarReconnect: boolean
}

// Single source of truth for "does this candidate have a Gmail/Calendar
// connection that expired mid-testing-mode and needs re-authorizing" — used
// by ReconnectBanner so the reminder can be dropped onto any page (Network,
// Jobs, the Dashboard/Sprint) without each one duplicating its own query.
export async function getReconnectStatus(candidateId: string): Promise<ReconnectStatus> {
  const [email, calendar] = await Promise.all([
    prisma.emailConnection.findFirst({
      where: { candidateId, disconnectedAt: null },
      select: { needsReconnectAt: true },
    }),
    prisma.calendarConnection.findFirst({
      where: { candidateId, disconnectedAt: null },
      select: { needsReconnectAt: true },
    }),
  ])
  return {
    needsGmailReconnect: !!email?.needsReconnectAt,
    needsCalendarReconnect: !!calendar?.needsReconnectAt,
  }
}
