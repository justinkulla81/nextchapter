import 'server-only'
import { prisma } from '@/lib/prisma'
import { getCoachClientSummaries, type ClientSummary } from './client-summary'
import { detectAvoidancePattern } from './pre-session-brief'
import { getCoachTriggers, type CoachTrigger } from './triggers'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import type { Grade } from '@/lib/scoring/grade'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { getEarnedPoints } from '@/lib/weekly/action-effort'
import { MOOD_LABEL, MOOD_SCORE } from '@/lib/daily/mood-labels'

export interface CaseloadEntry extends ClientSummary {
  isStalled: boolean
  triggers: CoachTrigger[]
  marketRealityGrade: Grade | null
  activityThisWeekPoints: number
  activityLastWeekPoints: number
  sentimentLabel: string | null
  sentimentTrend: 'up' | 'down' | null
}

async function getWeeklyActivityPoints(candidateId: string): Promise<{ thisWeek: number; lastWeek: number }> {
  const thisMonday = getMondayOfWeek(new Date())
  const lastMonday = getMondayOfWeek(new Date(thisMonday.getTime() - 24 * 60 * 60 * 1000))
  const [thisSprint, lastSprint] = await Promise.all([
    prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate: thisMonday } } }),
    prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate: lastMonday } } }),
  ])
  const sumPoints = (sprint: { committedActions: unknown } | null) =>
    sprint
      ? (sprint.committedActions as unknown as CommittedAction[]).reduce((total, a) => total + getEarnedPoints(a), 0)
      : 0
  return { thisWeek: sumPoints(thisSprint), lastWeek: sumPoints(lastSprint) }
}

// Same 0.75-on-a-0-3-scale delta used for the low-sentiment/declining-trend
// checks elsewhere (getSentimentAlert in mood.ts, getMoodPatternNote in
// pre-session-brief.ts) — MOOD_SCORE is an even 30-point-per-step mapping of
// that same 0-3 scale (10/40/70/100), so 0.75 * 30 is the equivalent delta
// on this scale.
const SENTIMENT_TREND_THRESHOLD = 22.5

async function getSentimentSummary(candidateId: string): Promise<{ label: string | null; trend: 'up' | 'down' | null }> {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13)
  const checkIns = await prisma.dailyCheckIn.findMany({
    where: { candidateId, checkedInAt: { gte: fourteenDaysAgo } },
    orderBy: { checkedInAt: 'desc' },
    select: { mood: true },
  })
  if (checkIns.length === 0) return { label: null, trend: null }

  const label = MOOD_LABEL[checkIns[0].mood]
  if (checkIns.length < 3) return { label, trend: null }

  const mid = Math.floor(checkIns.length / 2)
  const avg = (arr: typeof checkIns) => arr.reduce((sum, c) => sum + MOOD_SCORE[c.mood], 0) / arr.length
  const recentAvg = avg(checkIns.slice(0, mid))
  const olderAvg = avg(checkIns.slice(mid))
  if (recentAvg - olderAvg >= SENTIMENT_TREND_THRESHOLD) return { label, trend: 'up' }
  if (olderAvg - recentAvg >= SENTIMENT_TREND_THRESHOLD) return { label, trend: 'down' }
  return { label, trend: null }
}

// Roster-level rollup — reuses getCoachClientSummaries (already zero extra
// queries) and loops detectAvoidancePattern + getCoachTriggers + the three
// caseload-table metrics (Market Reality, weekly activity, sentiment) per
// client. N+1 across all of these, but fine at the caseload sizes this
// product actually has right now (a handful of coaches, each with a handful
// of clients) — same "don't over-engineer for volume you don't have" call
// made throughout this batch.
export async function getCoachCaseload(coachId: string): Promise<CaseloadEntry[]> {
  const clients = await getCoachClientSummaries(coachId)
  return Promise.all(
    clients.map(async (client) => {
      const [isStalled, triggers, marketReality, activity, sentiment] = await Promise.all([
        detectAvoidancePattern(client.id).then((p) => p !== null),
        getCoachTriggers(client.id, client.trend),
        computeMarketRealityCompositeGrade(client.id),
        getWeeklyActivityPoints(client.id),
        getSentimentSummary(client.id),
      ])
      return {
        ...client,
        isStalled,
        triggers,
        marketRealityGrade: marketReality?.grade ?? null,
        activityThisWeekPoints: activity.thisWeek,
        activityLastWeekPoints: activity.lastWeek,
        sentimentLabel: sentiment.label,
        sentimentTrend: sentiment.trend,
      }
    })
  )
}
