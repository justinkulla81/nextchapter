import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import type { CommittedAction } from '@/lib/weekly/sprint'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { MOOD_LABEL } from '@/lib/daily/mood-labels'
import type { Grade } from '@/lib/scoring/grade'
import { normalizeGradeSnapshot } from '@/lib/scoring/dossier-competencies'
import { getKeyCoachingOnboardingAnswers } from '@/lib/coach/onboarding-form'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'
import { getLatestDimensionSnapshot } from '@/lib/coach/dimension-history'
import { isDimensionConcerning, SESSION_DIMENSION_LABEL, SESSION_DIMENSION_STATUS_LABEL, type DimensionReading } from '@/lib/coach/session-dimensions'
import { getInterventionSuggestions, type Intervention } from '@/lib/coach/interventions'

const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']

export type Trend = 'up' | 'down' | 'flat' | null

export interface AvoidancePattern {
  actionType: string
  weeksAvoided: number
}

export interface PreSessionBrief {
  candidateName: string
  weekNumber: number | null
  executionGrade: Grade | null
  trend: Trend
  thisWeekActions: { text: string; completed: boolean }[]
  avoidancePattern: AvoidancePattern | null
  lastMood: { label: string; checkedInAt: Date } | null
  moodPatternNote: string | null
  suggestedOpeningQuestion: string
  // Prompt 60 — pulled straight from the Coaching Onboarding Form once
  // submitted; useful context for prepping an early session, not just a
  // one-time reference buried in Coaching Notes.
  nonNegotiables: string | null
  biggestWorry: string | null
  // Session Prep loop-close — the coach-editable "focus for next session"
  // note from this candidate's most recent CoachSession, regardless of
  // which coach logged it (a candidate's coach could change in principle;
  // the note itself is about the candidate's context, not the coach).
  lastFocusNote: string | null
  // §A5.1 — the latest logged status/trend per dimension (each dimension's
  // own most recent reading, not necessarily all from the same session —
  // see getLatestDimensionSnapshot). §A5.1's own intervention rule ("2+
  // dimensions at-risk/declining") applied against this same snapshot.
  dimensions: DimensionReading[]
  interventionSuggestions: Intervention[]
}

// Reused by the Session Impact Report (src/lib/coach/session-impact.ts) to
// tell whether a previously-flagged pattern has shifted since the last
// session — one implementation, not duplicated.
export async function detectAvoidancePattern(candidateId: string): Promise<AvoidancePattern | null> {
  // Admin-configurable "streak break" trigger threshold — Master Build
  // Script §A5.3. Lookback window is threshold + 1 weeks so there's always
  // at least one week of headroom beyond the threshold itself; at the
  // default threshold of 2 this reproduces the previous hardcoded take: 3.
  const { streakBreakWeeksThreshold } = await getCoachingSettings()

  const thisMonday = getMondayOfWeek(new Date())
  const recentSprints = await prisma.weeklySprint.findMany({
    where: { candidateId, weekStartDate: { lte: thisMonday } },
    orderBy: { weekStartDate: 'desc' },
    take: streakBreakWeeksThreshold + 1,
  })
  if (recentSprints.length < streakBreakWeeksThreshold) return null

  const byActionType = new Map<string, { committed: number; completed: number }>()
  for (const sprint of recentSprints) {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    const seenTypesThisWeek = new Set<string>()
    for (const action of actions) {
      if (!action.actionType) continue
      seenTypesThisWeek.add(action.actionType)
    }
    for (const actionType of seenTypesThisWeek) {
      const entry = byActionType.get(actionType) ?? { committed: 0, completed: 0 }
      entry.committed += 1
      const completedThisType = actions.some((a) => a.actionType === actionType && a.completed)
      if (completedThisType) entry.completed += 1
      byActionType.set(actionType, entry)
    }
  }

  // Flag an actionType committed in 2+ of the recent weeks but never once
  // completed, while at least one other actionType did get completed —
  // otherwise this just reflects a slow week overall, not a specific avoidance.
  const anyTypeCompleted = [...byActionType.values()].some((v) => v.completed > 0)
  if (!anyTypeCompleted) return null

  for (const [actionType, counts] of byActionType) {
    if (counts.committed >= streakBreakWeeksThreshold && counts.completed === 0) {
      return { actionType, weeksAvoided: counts.committed }
    }
  }
  return null
}

async function getMoodPatternNote(candidateId: string): Promise<{ lastMood: PreSessionBrief['lastMood']; note: string | null }> {
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const checkIns = await prisma.dailyCheckIn.findMany({
    where: { candidateId, checkedInAt: { gte: twoWeeksAgo } },
    orderBy: { checkedInAt: 'desc' },
  })

  if (checkIns.length === 0) return { lastMood: null, note: null }

  const lastMood = { label: MOOD_LABEL[checkIns[0].mood], checkedInAt: checkIns[0].checkedInAt }

  if (checkIns.length < 3) return { lastMood, note: null }

  const moodValue: Record<string, number> = { STUCK: 0, GETTING_THERE: 1, MOVING: 2, FIRED_UP: 3 }
  const half = Math.floor(checkIns.length / 2)
  const recentAvg = checkIns.slice(0, half).reduce((sum, c) => sum + moodValue[c.mood], 0) / half
  const olderAvg =
    checkIns.slice(half).reduce((sum, c) => sum + moodValue[c.mood], 0) / (checkIns.length - half)

  let note: string | null = null
  if (recentAvg - olderAvg >= 0.75) note = 'Trending up over the last couple of weeks.'
  else if (olderAvg - recentAvg >= 0.75) note = 'Trending down over the last couple of weeks.'

  return { lastMood, note }
}

async function generateOpeningQuestion(facts: string): Promise<string> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `A career coach is about to start a 1:1 session with a client. Based on the facts below, suggest ONE specific opening question the coach could ask — grounded in the real data, not generic. Do not produce a scorecard or list — just the single question, as plain text, no preamble.\n\nFacts:\n${facts}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    return text.trim() || "How has this week felt for you overall?"
  } catch {
    return "How has this week felt for you overall?"
  }
}

export async function getPreSessionBrief(candidateId: string): Promise<PreSessionBrief> {
  const [
    candidate,
    recentReports,
    currentSprint,
    avoidancePattern,
    moodInfo,
    keyOnboardingAnswers,
    lastSessionWithFocusNote,
    dimensions,
  ] = await Promise.all([
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
      prisma.marketRealityReport.findMany({
        where: { candidateId },
        orderBy: { generatedAt: 'desc' },
        take: 2,
        select: { dossierGradeAtGeneration: true },
      }),
      prisma.weeklySprint.findUnique({
        where: { candidateId_weekStartDate: { candidateId, weekStartDate: getMondayOfWeek(new Date()) } },
      }),
      detectAvoidancePattern(candidateId),
      getMoodPatternNote(candidateId),
      getKeyCoachingOnboardingAnswers(candidateId),
      prisma.coachSession.findFirst({
        where: { candidateId, focusNote: { not: null } },
        orderBy: { occurredAt: 'desc' },
        select: { focusNote: true },
      }),
      getLatestDimensionSnapshot(candidateId),
    ])

  const concerningDimensions = dimensions.filter(isDimensionConcerning)
  const interventionSuggestions =
    concerningDimensions.length >= 2 ? getInterventionSuggestions(concerningDimensions.map((d) => d.key)) : []

  const [latestReport, previousReport] = recentReports
  const executionGrade =
    normalizeGradeSnapshot(latestReport?.dossierGradeAtGeneration)?.grade ?? null
  const previousGrade =
    normalizeGradeSnapshot(previousReport?.dossierGradeAtGeneration)?.grade ?? null
  const trend: Trend =
    executionGrade && previousGrade
      ? GRADE_ORDER.indexOf(executionGrade) > GRADE_ORDER.indexOf(previousGrade)
        ? 'up'
        : GRADE_ORDER.indexOf(executionGrade) < GRADE_ORDER.indexOf(previousGrade)
          ? 'down'
          : 'flat'
      : null

  const weekNumber = candidate.registrationCompletedAt
    ? Math.floor((Date.now() - candidate.registrationCompletedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : null

  const thisWeekActions = currentSprint
    ? (currentSprint.committedActions as unknown as CommittedAction[]).map((a) => ({
        text: a.text,
        completed: a.completed,
      }))
    : []

  const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This candidate'

  const facts = [
    `Week ${weekNumber ?? 'unknown'} in search.`,
    executionGrade ? `Current Market Reality: ${executionGrade}${trend ? ` (${trend})` : ''}.` : 'No grade yet.',
    thisWeekActions.length > 0
      ? `This week's actions: ${thisWeekActions.map((a) => `${a.text} (${a.completed ? 'done' : 'not done'})`).join('; ')}.`
      : 'No actions committed this week yet.',
    avoidancePattern
      ? `Has committed to "${avoidancePattern.actionType}" actions ${avoidancePattern.weeksAvoided} weeks running without completing any.`
      : '',
    moodInfo.lastMood ? `Last mood check-in: ${moodInfo.lastMood.label}.${moodInfo.note ? ` ${moodInfo.note}` : ''}` : '',
    keyOnboardingAnswers.nonNegotiables ? `Stated non-negotiables/constraints: ${keyOnboardingAnswers.nonNegotiables}` : '',
    keyOnboardingAnswers.biggestWorry ? `Stated biggest worry about the process: ${keyOnboardingAnswers.biggestWorry}` : '',
    lastSessionWithFocusNote?.focusNote ? `Focus flagged for this session: ${lastSessionWithFocusNote.focusNote}` : '',
    dimensions.some((d) => d.status)
      ? `Latest tracked dimensions: ${dimensions
          .filter((d) => d.status)
          .map((d) => `${SESSION_DIMENSION_LABEL[d.key]} — ${SESSION_DIMENSION_STATUS_LABEL[d.status!]}`)
          .join('; ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const suggestedOpeningQuestion = await generateOpeningQuestion(facts)

  return {
    candidateName,
    weekNumber,
    executionGrade,
    trend,
    thisWeekActions,
    avoidancePattern,
    lastMood: moodInfo.lastMood,
    moodPatternNote: moodInfo.note,
    nonNegotiables: keyOnboardingAnswers.nonNegotiables,
    biggestWorry: keyOnboardingAnswers.biggestWorry,
    suggestedOpeningQuestion,
    lastFocusNote: lastSessionWithFocusNote?.focusNote ?? null,
    dimensions,
    interventionSuggestions,
  }
}
