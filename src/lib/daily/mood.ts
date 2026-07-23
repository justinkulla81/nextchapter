import 'server-only'
import type { Mood } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MOOD_SCORE } from '@/lib/daily/mood-labels'

// Shared daily-reset boundary — also used by dashboard message and mood-card
// dismissal so "resets the next day" means the same thing everywhere.
export function startOfUTCDay(d: Date = new Date()): Date {
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

// Oldest-first time series for the Stats page motivation chart — one point
// per calendar day (dedupes same-day re-checks, since recordMoodCheckIn
// upserts today's row rather than creating a second one).
export async function getMoodHistory(
  candidateId: string,
  limit = 60
): Promise<{ date: Date; mood: Mood }[]> {
  const checkIns = await prisma.dailyCheckIn.findMany({
    where: { candidateId },
    orderBy: { checkedInAt: 'desc' },
    take: limit,
    select: { checkedInAt: true, mood: true },
  })
  return checkIns.reverse().map((c) => ({ date: c.checkedInAt, mood: c.mood }))
}

export interface SentimentAlert {
  lowSentiment: boolean
  reason: 'low_average' | 'declining_trend' | null
}

const LOW_SENTIMENT_THRESHOLD = 30 // mostly "Stuck" over the trailing window
const DECLINING_TREND_THRESHOLD = 0.75 // same threshold as the half-vs-half check below

// Real, threshold-based low-sentiment detection — not just the descriptive
// up/down trend note elsewhere, an actual signal to alert on. Fires when
// either the trailing 14-day average reads mostly "Stuck," or the first
// half of that window is meaningfully worse than the second half reversed
// (i.e. things have been trending down), using the same 0-3 mapping and
// delta threshold as getMoodPatternNote (src/lib/coach/pre-session-brief.ts).
export async function getSentimentAlert(candidateId: string): Promise<SentimentAlert> {
  const fourteenDaysAgo = startOfUTCDay(new Date())
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13)

  const checkIns = await prisma.dailyCheckIn.findMany({
    where: { candidateId, checkedInAt: { gte: fourteenDaysAgo } },
    orderBy: { checkedInAt: 'asc' },
    select: { mood: true },
  })

  if (checkIns.length === 0) return { lowSentiment: false, reason: null }

  const average = checkIns.reduce((sum, c) => sum + MOOD_SCORE[c.mood], 0) / checkIns.length
  if (average < LOW_SENTIMENT_THRESHOLD) return { lowSentiment: true, reason: 'low_average' }

  if (checkIns.length >= 3) {
    const moodValue: Record<Mood, number> = { STUCK: 0, GETTING_THERE: 1, MOVING: 2, FIRED_UP: 3 }
    const mid = Math.floor(checkIns.length / 2)
    const firstHalf = checkIns.slice(0, mid)
    const secondHalf = checkIns.slice(mid)
    const avg = (arr: typeof checkIns) => arr.reduce((sum, c) => sum + moodValue[c.mood], 0) / arr.length
    if (avg(firstHalf) - avg(secondHalf) >= DECLINING_TREND_THRESHOLD) {
      return { lowSentiment: true, reason: 'declining_trend' }
    }
  }

  return { lowSentiment: false, reason: null }
}
