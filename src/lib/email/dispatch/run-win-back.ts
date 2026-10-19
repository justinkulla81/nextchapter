import 'server-only'
import { prisma } from '@/lib/prisma'
import { shouldSendWeeklyExtraForTier } from '@/lib/email/notification-tier'
import { sendWinBackEmail } from '@/lib/email/send-win-back'
import { effectiveJourney } from '@/lib/journey/journey'
import { nextWinBackStep, winBackSpacedOut, WIN_BACK_AFTER_DAYS } from '@/lib/winback/sequence'

// Weekly (Wednesday). Members with no login or page activity for 21+ days get up to three
// emails (21, 42, 63 days quiet). Anyone who returns starts the count over.
export async function runWinBack(now = new Date()) {
  const oldest = new Date(now.getTime() - WIN_BACK_AFTER_DAYS[0] * 86_400_000)
  const candidates = await prisma.candidateProfile.findMany({
    where: {
      registrationCompletedAt: { not: null, lte: oldest },
      isSampleData: false,
      weeklyReportOptedOut: false,
      deactivatedAt: null,
    },
    select: { id: true, notificationTier: true, createdAt: true, journey: true, journeyDetails: true },
  })
  const ids = candidates.map((c) => c.id)
  const [logins, pages] = await Promise.all([
    prisma.candidateLoginEvent.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids } }, _max: { createdAt: true } }),
    prisma.candidatePageActivityEvent.groupBy({ by: ['candidateId'], where: { candidateId: { in: ids } }, _max: { createdAt: true } }),
  ])
  const last = new Map<string, Date>()
  for (const row of [...logins, ...pages]) {
    const at = row._max.createdAt
    if (at && (!last.get(row.candidateId) || at > last.get(row.candidateId)!)) last.set(row.candidateId, at)
  }

  let sent = 0
  for (const c of candidates) {
    try {
      if (!shouldSendWeeklyExtraForTier(c.notificationTier)) continue
      // Away on purpose: quiet is expected.
      if (effectiveJourney(c) === 'TIME_OFF') continue
      const lastActivity = last.get(c.id) ?? c.createdAt
      const lastWinBack = await prisma.candidateEmailSendLog.findFirst({ where: { candidateId: c.id, emailKey: 'WIN_BACK' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } })
      if (!winBackSpacedOut(lastWinBack?.sentAt ?? null, now)) continue
      const already = await prisma.candidateEmailSendLog.count({ where: { candidateId: c.id, emailKey: 'WIN_BACK', sentForDate: { gt: lastActivity } } })
      const step = nextWinBackStep(lastActivity, already, now)
      if (!step) continue
      if ((await sendWinBackEmail(c.id, step)).sent) sent += 1
    } catch (error) {
      console.error('Win-back failed for candidate', c.id, error)
    }
  }
  return { checked: candidates.length, sent }
}
