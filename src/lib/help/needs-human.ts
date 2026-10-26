import 'server-only'
import { prisma } from '@/lib/prisma'

/** A conversation counts as overdue once it has waited this long for a reply. */
export const OVERDUE_HOURS = 24

export type NeedsHuman = {
  /** Open conversations whose newest message is the customer's. */
  waiting: number
  /** Waiting longer than OVERDUE_HOURS. */
  overdue: number
  /** Waiting and flagged for crisis language, any age. These come first. */
  crisis: number
  /** Hours the oldest waiting conversation has been waiting. */
  oldestHours: number | null
  items: { id: string; subject: string; hours: number; crisis: boolean }[]
}

/**
 * Who needs a human reply. Report only: nothing here sends anything. The Help
 * inbox banner and the admin home read it; a scheduled digest can too.
 */
export async function getNeedsHuman(limit = 5): Promise<NeedsHuman> {
  const now = Date.now()
  const rows = await prisma.helpRequest.findMany({
    where: { status: 'OPEN', lastMessageFromAdmin: false },
    orderBy: [{ flaggedCrisis: 'desc' }, { lastMessageAt: 'asc' }],
    select: { id: true, subject: true, flaggedCrisis: true, lastMessageAt: true },
    take: 200,
  })
  const withHours = rows.map((r) => ({ id: r.id, subject: r.subject, crisis: r.flaggedCrisis, hours: Math.floor((now - r.lastMessageAt.getTime()) / 3600000) }))
  const overdue = withHours.filter((r) => r.hours >= OVERDUE_HOURS)
  return {
    waiting: withHours.length,
    overdue: overdue.length,
    crisis: withHours.filter((r) => r.crisis).length,
    oldestHours: withHours.length ? Math.max(...withHours.map((r) => r.hours)) : null,
    items: withHours.filter((r) => r.crisis || r.hours >= OVERDUE_HOURS).slice(0, limit),
  }
}
