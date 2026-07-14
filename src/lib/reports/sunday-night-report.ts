// Generates the Sunday Night Report — the weekly recurring touchpoint.
// Seven sections in order: Hireability Grade, Last Week's Work, Strengths &
// Weaknesses, Victoria's Observations, Straight Talk, This Week's Action
// Plan, and The A-List. See src/lib/weekly/sprint.ts for the committed-
// action data model this reads from, and src/lib/weekly/a-list.ts for the
// cross-candidate A-List computation (computed once per cron run and
// passed in, not recomputed per candidate).

import 'server-only'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { translateDimensionVectors, type DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { computeHireabilityGrade, GRADE_LABEL } from '@/lib/scoring/hireability-grade'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { actionPlanItemTypes } from '@/lib/reports/hireability-report'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { TIER_UNLOCKS } from '@/lib/community/unlock-tier'
import type { AListResult } from '@/lib/weekly/a-list'

const sundayNightReportSchema = z.object({
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })).min(2).max(4),
  weaknesses: z.array(z.object({ title: z.string(), detail: z.string() })).min(1).max(3),
  observations: z.object({
    motivationReading: z.string(),
    progressPatterns: z.string(),
    dataInconsistency: z.string().nullable(),
  }),
  straightTalk: z.string(),
  suggestedActionPlan: z
    .array(
      z.object({
        text: z.string(),
        actionType: z.enum(actionPlanItemTypes).optional(),
        isAStandard: z.boolean(),
        isStretch: z.boolean().optional(),
      })
    )
    .min(3)
    .max(6),
})

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

You are writing this week's Sunday Night Report as Victoria — the candidate's most important recurring touchpoint. It must be honest, specific, and useful without them opening the app. Everything below is real data about their week; never invent facts not given.

Write:
1. Strengths (2-4): specific to THIS WEEK's actual behavior and profile, not generic praise.
2. Weaknesses (1-3): grounded in what the week's behavior and grade actually show — direct, not harsh.
3. Observations — three distinct things, each genuinely useful, not restating the same point three times:
   - motivationReading: what their mood check-in pattern and action-completion behavior this week suggests about their current state — not what they said about themselves, what they DID.
   - progressPatterns: did they front-load the week (complete actions early) or back-load it (cram at the end)? Did they complete easy actions and skip hard ones, or the reverse? Name the pattern because it's useful, not to shame them.
   - dataInconsistency: ONLY if their Work Style Assessment self-report meaningfully contradicts this week's observed behavior below — state it plainly, without judgment. If there's no real contradiction, set this to null rather than manufacturing one.
4. Straight Talk: 1-3 sentences, direct, no hedging, no softening. This is the most important part of the report — say the one true thing that matters most this week, whether that's encouragement to keep pace or a direct call-out of avoidance.
5. Suggested action plan for the UPCOMING week (3-6 items): specific, each tagged with an optional actionType where it matches a real platform feature. Mark the 2-3 highest-leverage items "isAStandard: true" — these are explicitly "complete these and you've earned your A this week." At most one item may be "isStretch: true" — an optional extra for a motivated week.

HARD REQUIREMENT — no raw numbers, anywhere: never cite a raw numeric score (e.g. "88/100", "a 62") in any written field. Numbers below are for your own reasoning only. When referencing standing, use only the letter grade (A-F) or its label (Excellent/Good/Average/Needs work/Critical gap) — never a number.

Underlying theme (weave in naturally, at least once — ideally in Straight Talk or the action plan intro): not everyone who searches will land the role they want — never promise an outcome — but doing the real work meaningfully improves their odds, and Search Execution is the lever entirely in their hands. If this is Week 1 (no Success Sprint history yet), make clear Search Execution starts as a blank page they're about to write, not a bad grade. Somewhere, briefly tie completing this week's plan to earning their A and to what building it up unlocks over time: ${TIER_UNLOCKS[3]} at Tier 3, ${TIER_UNLOCKS[4]} at Tier 4, and ${TIER_UNLOCKS[5]} at Tier 5.

Candidate data:
`

export async function generateSundayNightReport(candidateId: string, aList: AListResult): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      references: true,
      workSamples: true,
      workHistory: true,
      linkedInActivityLogs: true,
      jobPostings: true,
      resumes: true,
      communityPosts: { where: { isActive: true } },
      assessmentResponses: { orderBy: { completedAt: 'desc' }, take: 1 },
    },
  })

  const weekStartDate = getMondayOfWeek(new Date())
  const weekEndExclusive = new Date(weekStartDate)
  weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7)

  const [currentSprint, previousReport, checkIns] = await Promise.all([
    prisma.weeklySprint.findUnique({ where: { candidateId_weekStartDate: { candidateId, weekStartDate } } }),
    prisma.sundayNightReport.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'desc' } }),
    prisma.dailyCheckIn.findMany({
      where: { candidateId, checkedInAt: { gte: weekStartDate, lt: weekEndExclusive } },
      orderBy: { checkedInAt: 'asc' },
    }),
  ])

  const isFirstWeek = !previousReport

  const committedActions = currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : []
  const completedActions = committedActions.filter((a) => a.completed)
  const skippedActions = committedActions.filter((a) => !a.completed)

  const grade = await computeHireabilityGrade(candidate)
  const previousGradeSnapshot = previousReport?.gradeSnapshot ?? null

  const latestAssessment = candidate.assessmentResponses[0]
  const dimensionSummary = latestAssessment
    ? translateDimensionVectors(latestAssessment.dimensionVectors as unknown as DimensionVectors)
    : null

  const onAList = aList.memberCandidateIds.has(candidateId)

  const summary = `
Week: ${isFirstWeek ? 'Week 1 (no prior Sunday report exists yet)' : 'Week 2+'}

Hireability Grade — Market Reality: ${grade.marketReality.grade} (${GRADE_LABEL[grade.marketReality.grade]}, ${grade.marketReality.score}/100)
Hireability Grade — Search Execution: ${grade.searchExecution.grade} (${GRADE_LABEL[grade.searchExecution.grade]}, ${grade.searchExecution.score}/100)
  ${grade.searchExecution.engines.map((e) => `${e.label} Engine: ${e.grade} (${e.score}/100)`).join('\n  ')}

This week's committed actions: ${committedActions.length === 0 ? 'none committed (no Success Sprint set up this week)' : committedActions.map((a) => `"${a.text}" (${a.points} pts) — ${a.completed ? `completed${a.completedAt ? ` on ${new Date(a.completedAt).toDateString()}` : ''}` : 'skipped'}`).join('; ')}
Total points committed this week: ${committedActions.reduce((sum, a) => sum + a.points, 0)}, earned so far: ${committedActions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)}

Mood check-ins this week (chronological): ${checkIns.length === 0 ? 'none logged' : checkIns.map((c) => `${c.checkedInAt.toDateString()}: ${c.mood}`).join('; ')}

Current check-in streak: ${candidate.currentStreak} days

Work-style profile (self-reported): ${
    dimensionSummary
      ? Object.entries(dimensionSummary)
          .map(([dim, desc]) => `${dim}: ${desc}`)
          .join('; ')
      : 'assessment not completed'
  }

Target role: ${candidate.targetRoleType ?? 'not specified'}
References completed: ${candidate.references.filter((r) => r.status === 'COMPLETED').length}
Work samples: ${candidate.workSamples.length}
LinkedIn posts logged in the last 30 days: ${candidate.linkedInActivityLogs.filter((l) => l.loggedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
`.trim()

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 6000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(sundayNightReportSchema), effort: 'medium' },
    messages: [{ role: 'user', content: PROMPT_PREFIX + summary }],
  })
  const message = await stream.finalMessage()
  const data = message.parsed_output
  if (!data) return

  await prisma.sundayNightReport.create({
    data: {
      candidateId,
      weekStartDate,
      gradeSnapshot: grade as unknown as Prisma.InputJsonValue,
      previousGradeSnapshot: previousGradeSnapshot === null ? Prisma.DbNull : (previousGradeSnapshot as Prisma.InputJsonValue),
      lastWeekCommittedCount: committedActions.length,
      lastWeekCompletedCount: completedActions.length,
      lastWeekCompletedTexts: completedActions.map((a) => a.text),
      lastWeekSkippedTexts: skippedActions.map((a) => a.text),
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      observations: data.observations,
      straightTalk: data.straightTalk,
      suggestedActionPlan: data.suggestedActionPlan,
      onAList,
      aListMemberNames: aList.memberNames,
      aListCount: aList.count,
    },
  })
}
