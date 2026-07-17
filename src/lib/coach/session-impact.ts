import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { detectAvoidancePattern } from '@/lib/coach/pre-session-brief'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import type { Grade, HireabilityGrade } from '@/lib/scoring/grade'
import { captureServerEvent } from '@/lib/posthog/server'

export interface SessionImpactReport {
  sessionId: string
  gradeMovement: { from: Grade | null; to: Grade | null }
  actionsCompletedSinceLastSession: number
  avoidancePatternStillPresent: string | null
  summary: string
  directives: string | null
}

export async function getSessionImpactReport(candidateId: string): Promise<SessionImpactReport | null> {
  const sessions = await prisma.coachSession.findMany({
    where: { candidateId },
    orderBy: { occurredAt: 'desc' },
    take: 2,
  })
  if (sessions.length === 0) return null

  const [latestSession, previousSession] = sessions
  const windowStart = previousSession?.occurredAt ?? null

  const [gradeBefore, gradeAfter, sprintsInWindow, avoidancePattern] = await Promise.all([
    windowStart
      ? prisma.hireabilityReport.findFirst({
          where: { candidateId, generatedAt: { lte: windowStart } },
          orderBy: { generatedAt: 'desc' },
          select: { hireabilityGradeAtGeneration: true },
        })
      : null,
    prisma.hireabilityReport.findFirst({
      where: { candidateId, generatedAt: { lte: latestSession.occurredAt } },
      orderBy: { generatedAt: 'desc' },
      select: { hireabilityGradeAtGeneration: true },
    }),
    prisma.weeklySprint.findMany({
      where: {
        candidateId,
        weekStartDate: {
          gte: getMondayOfWeek(windowStart ?? latestSession.occurredAt),
          lte: latestSession.occurredAt,
        },
      },
    }),
    detectAvoidancePattern(candidateId),
  ])

  const gradeFrom =
    (gradeBefore?.hireabilityGradeAtGeneration as unknown as HireabilityGrade | undefined)?.searchExecution.grade ??
    null
  const gradeTo =
    (gradeAfter?.hireabilityGradeAtGeneration as unknown as HireabilityGrade | undefined)?.searchExecution.grade ??
    null

  const actionsCompletedSinceLastSession = sprintsInWindow.reduce((sum, sprint) => {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    return sum + actions.filter((a) => a.completed).length
  }, 0)

  const facts = [
    windowStart ? `Grade moved from ${gradeFrom ?? 'no grade'} to ${gradeTo ?? 'no grade'} since the last session.` : `Current grade: ${gradeTo ?? 'no grade yet'}.`,
    `Completed ${actionsCompletedSinceLastSession} action${actionsCompletedSinceLastSession === 1 ? '' : 's'} since the last session.`,
    avoidancePattern
      ? `Still avoiding "${avoidancePattern.actionType}" actions (${avoidancePattern.weeksAvoided} weeks running).`
      : 'No specific avoidance pattern detected right now.',
  ].join('\n')

  const summary = await generateImpactSummary(facts)

  return {
    sessionId: latestSession.id,
    gradeMovement: { from: gradeFrom, to: gradeTo },
    actionsCompletedSinceLastSession,
    avoidancePatternStillPresent: avoidancePattern?.actionType ?? null,
    summary,
    directives: latestSession.directives,
  }
}

// Called once from the dashboard data load — shows the report exactly once,
// the same "fetch + mark as delivered in the same request" pattern already
// used by resolveLatestReport() in src/app/dashboard/page.tsx.
export async function getUnviewedSessionImpact(candidateId: string): Promise<SessionImpactReport | null> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentUnviewed = await prisma.coachSession.findFirst({
    where: { candidateId, occurredAt: { gte: sevenDaysAgo }, viewedByCandidateAt: null },
    orderBy: { occurredAt: 'desc' },
  })
  if (!recentUnviewed) return null

  const report = await getSessionImpactReport(candidateId)
  if (!report) return null

  await prisma.coachSession.update({
    where: { id: recentUnviewed.id },
    data: { viewedByCandidateAt: new Date() },
  })

  captureServerEvent(candidateId, 'session_impact_report_viewed')

  return report
}

async function generateImpactSummary(facts: string): Promise<string> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `Write a short, warm summary for a job-search candidate about their progress since their last coaching session, based strictly on the facts below. Cover: what's changed, one thing that's clearly working, and one thing to focus on next. 3-4 sentences total, no scorecard, no letter grades cited directly (describe direction/movement in plain language instead), plain text only.\n\nFacts:\n${facts}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    return text.trim() || "Nice work showing up to your last session — keep the momentum going this week."
  } catch {
    return "Nice work showing up to your last session — keep the momentum going this week."
  }
}
