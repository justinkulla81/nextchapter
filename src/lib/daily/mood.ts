import 'server-only'
import type { Mood } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function startOfUTCDay(d: Date): Date {
  const copy = new Date(d)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

export async function recordMoodCheckIn(
  candidateId: string,
  mood: Mood
): Promise<{ streak: number; alreadyCheckedInToday: boolean }> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const now = new Date()
  const todayStart = startOfUTCDay(now)

  const existingToday = await prisma.dailyCheckIn.findFirst({
    where: { candidateId, checkedInAt: { gte: todayStart } },
    orderBy: { checkedInAt: 'desc' },
  })

  if (existingToday) {
    await prisma.dailyCheckIn.update({ where: { id: existingToday.id }, data: { mood } })
    return { streak: candidate.currentStreak, alreadyCheckedInToday: true }
  }

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)
  const checkedInYesterday =
    candidate.lastCheckInAt !== null &&
    candidate.lastCheckInAt >= yesterdayStart &&
    candidate.lastCheckInAt < todayStart

  const newStreak = checkedInYesterday ? candidate.currentStreak + 1 : 1

  await prisma.dailyCheckIn.create({ data: { candidateId, mood } })
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      lastCheckInAt: now,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, candidate.longestStreak),
    },
  })

  return { streak: newStreak, alreadyCheckedInToday: false }
}

export async function getTodaysMood(candidateId: string): Promise<Mood | null> {
  const todayStart = startOfUTCDay(new Date())
  const existingToday = await prisma.dailyCheckIn.findFirst({
    where: { candidateId, checkedInAt: { gte: todayStart } },
    orderBy: { checkedInAt: 'desc' },
  })
  return existingToday?.mood ?? null
}

// currentStreak only counts consecutive days, so it silently goes back to 1
// after any gap — checkInsLast7Days is the "how many days out of the last 7"
// fallback the confirmation copy needs once a streak breaks.
export async function getCheckInSummary(
  candidateId: string
): Promise<{ streak: number; checkInsLast7Days: number; isConsecutive: boolean }> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { currentStreak: true },
  })

  const sevenDaysAgo = startOfUTCDay(new Date())
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)

  const recentCheckIns = await prisma.dailyCheckIn.findMany({
    where: { candidateId, checkedInAt: { gte: sevenDaysAgo } },
    select: { checkedInAt: true },
  })
  const distinctDays = new Set(recentCheckIns.map((c) => startOfUTCDay(c.checkedInAt).getTime()))

  return {
    streak: candidate.currentStreak,
    checkInsLast7Days: distinctDays.size,
    isConsecutive: distinctDays.size <= candidate.currentStreak,
  }
}
