import 'server-only'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000

/** WARN notices a company filed 12 to 24 months ago (the 12 months before the window the page already shows). */
export async function layoffNoticesYearBefore(companyId: string): Promise<number> {
  const from = new Date(Date.now() - 2 * 365 * DAY)
  const to = new Date(Date.now() - 365 * DAY)
  return prisma.warnNotice
    .count({ where: { companyId, dismissedAt: null, OR: [{ noticeDate: { gte: from, lt: to } }, { noticeDate: null, fetchedAt: { gte: from, lt: to } }] } })
    .catch(() => 0)
}
