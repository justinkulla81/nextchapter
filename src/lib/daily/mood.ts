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
