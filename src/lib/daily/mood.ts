import 'server-only'
import type { Mood } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const MOOD_ORDER: Mood[] = ['STUCK', 'GETTING_THERE', 'MOVING', 'FIRED_UP']

export const MOOD_EMOJI: Record<Mood, string> = {
  STUCK: '😔',
  GETTING_THERE: '😐',
  MOVING: '🙂',
  FIRED_UP: '💪',
}

export const MOOD_LABEL: Record<Mood, string> = {
  STUCK: 'Stuck',
  GETTING_THERE: 'Getting there',
  MOVING: 'Moving',
  FIRED_UP: 'Fired up',
}

// Victoria's immediate reaction to the tapped mood — shown right after
// check-in, ahead of today's primary action.
export const MOOD_RESPONSE: Record<Mood, string> = {
  STUCK: "That's real, and it happens in every search. Let's not tackle everything today — just the smallest next step.",
  GETTING_THERE: "Good — that counts as progress. Here's today's move.",
  MOVING: "You're building something real. Let's keep the momentum going.",
  FIRED_UP: "Let's use it. Here's today's move — and a stretch option if you want more.",
}

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
