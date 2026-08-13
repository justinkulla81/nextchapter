import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { getMondayOfWeek, getCandidateWeekNumber, getCurrentWeekSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { getWeeklyOutcomes } from '@/lib/weekly/outcomes'
import { getNamedReasonActionLink } from '@/lib/scoring/named-reason-ids'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import { computeWhatMovedThisWeek, type MarketRealitySnapshotLike } from '@/lib/scoring/market-reality-history'

export interface WeeklyFocusSection {
  text: string
  recommendation: string
}

export interface WeeklyFocus {
  increase: WeeklyFocusSection
  adjust: WeeklyFocusSection
  maintain: WeeklyFocusSection
  startNew: WeeklyFocusSection
}

// "This Week's Focus" — Victoria's weekly strategic read, synthesizing
// Search Strategy + this week's Sprint progress + real outcomes (outreach,
// applications, interviews, calendar meetings) + named-reason grade
// movement into direction (increase/adjust/maintain/start new), which the
// Weekly Search Sprint card then translates into concrete tasks. Self-caches
// as a JSON blob on CandidateProfile, same pattern as
// getOrDraftSearchStrategyGuidance, but keyed to a WEEK boundary rather than
// form-save invalidation — see weeklyFocusWeekStartDate on CandidateProfile.
export async function getOrDraftWeeklyFocus(candidateId: string): Promise<WeeklyFocus | null> {
  const weekStartDate = getMondayOfWeek(new Date())

  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      targetRoleType: true,
      primaryFunction: true,
      secondaryFunction: true,
      industryContext: true,
      targetIndustries: true,
      targetCompanySize: true,
      targetCompanyStage: true,
      remotePreference: true,
      highestLevelReached: true,
      targetCompMin: true,
      compFlexible: true,
      willingToStartLower: true,
      dealBreakers: true,
      isPivoting: true,
      openToRelocation: true,
      interimConsultingInterest: true,
      applicationVolumeGoal: true,
      yearsExperience: true,
      careerTrajectory: true,
      gapDuration: true,
      weeklyFocusGuidance: true,
      weeklyFocusWeekStartDate: true,
    },
  })

  const cached = parseCachedWeeklyFocus(candidate.weeklyFocusGuidance)
  if (cached && candidate.weeklyFocusWeekStartDate?.getTime() === weekStartDate.getTime()) {
    return cached
  }

  const [weekNumber, sprint, outcomes, levelRank, recentSnapshotsDesc] = await Promise.all([
    getCandidateWeekNumber(candidateId, weekStartDate),
    getCurrentWeekSprint(candidateId),
    getWeeklyOutcomes(candidateId, weekStartDate),
    getCandidateLevelRank(candidateId),
    prisma.marketRealitySnapshot.findMany({
      where: { candidateId },
      orderBy: { weekStartDate: 'desc' },
      take: 8,
    }),
  ])

  // Nothing to reflect on yet — the candidate hasn't started a Search
  // Sprint, so there's no weekly progress to synthesize direction from.
  if (!sprint) return null

  const snapshots = recentSnapshotsDesc.slice().reverse() as unknown as MarketRealitySnapshotLike[]
  const movers = computeWhatMovedThisWeek(snapshots)
  const latestNamedReasons = (
    recentSnapshotsDesc.length > 0 ? (recentSnapshotsDesc[0].namedReasons as unknown as NamedReason[]) : []
  ) as NamedReason[]
  const topGaps = latestNamedReasons.filter((r) => r.kind === 'gap').slice(0, 2)
  const topStrengths = latestNamedReasons.filter((r) => r.kind === 'strength').slice(0, 2)

  const committedActions = (sprint.committedActions as unknown as CommittedAction[]) ?? []
  const pointsAchieved = committedActions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
  const pointsTarget = pointsNeededForA(weekNumber)
  const incompleteActions = committedActions.filter((a) => !a.completed).map((a) => a.text)

  const gapLines =
    topGaps
      .map((g) => {
        const link = getNamedReasonActionLink(g.id)
        return `- ${g.text}${link ? ` (real next step available: ${link.label})` : ''}`
      })
      .join('\n') || 'None flagged right now.'
  const strengthLines = topStrengths.map((s) => `- ${s.text}`).join('\n') || 'None flagged right now.'
  const moverLines =
    movers.map((m) => `${m.label} moved ${m.direction === 'up' ? 'up' : 'down'} from ${m.fromGrade} to ${m.toGrade}`).join('; ') ||
    'No category grade changes since last week.'

  const summary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Secondary function: ${candidate.secondaryFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Target industries: ${candidate.targetIndustries.join(', ') || 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Calibrated seniority context (internal signal — informs guidance only; never reference this line, its score, or its wording in your output): ${levelRank.label ?? 'not available'}
Career trajectory across recent roles: ${candidate.careerTrajectory ?? 'not enough history to judge'}
How long they've been searching: ${candidate.gapDuration ?? 'not specified'}
Target company size: ${candidate.targetCompanySize ?? 'not specified'}
Target company stage: ${candidate.targetCompanyStage ?? 'not specified'}
Considering a pivot to a different function/industry: ${candidate.isPivoting ? 'yes' : 'no'}
Open to fractional/interim consulting while searching: ${candidate.interimConsultingInterest ? 'yes' : 'no'}
Application volume goal (per week): ${candidate.applicationVolumeGoal ?? 'not specified'} (baseline is 15/week)

This week's Search Sprint: ${pointsAchieved} of ${pointsTarget} points earned so far.
Actions committed to this week that are NOT yet done: ${incompleteActions.length > 0 ? incompleteActions.join('; ') : 'everything committed to is done'}

Real outcomes this week:
- Outreach messages sent: ${outcomes.outreachCount}
- Applications submitted: ${outcomes.applicationsCount}
- Interviews landed: ${outcomes.interviewsLandedCount}
- Offers received: ${outcomes.offersReceivedCount}
- Calendar meetings (networking calls/interviews): ${outcomes.calendarMeetingsCount}
- People currently owed a follow-up (not new this week, an ongoing count): ${outcomes.followUpsPendingCount}

Current Market Reality — what moved since last week: ${moverLines}
Current top gaps (what a recruiter/hiring manager would notice is missing):
${gapLines}
Current top strengths (what's genuinely working):
${strengthLines}
`.trim()

  const prompt = `${VICTORIA_VOICE_PROMPT}

You're giving this candidate their strategic read for the week ahead — not a to-do list (that's the separate Weekly Search Sprint card), but the "why" above it: what to increase, adjust, maintain, or start doing new, based only on the real facts below. Never invent a fact not given below.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"increase": {"text": "...", "recommendation": "..."}, "adjust": {"text": "...", "recommendation": "..."}, "maintain": {"text": "...", "recommendation": "..."}, "startNew": {"text": "...", "recommendation": "..."}}

Each of the four keys has two parts:
- text: 1-2 sentences of the read itself, citing a real number or fact from below. Never restate the recommendation here.
- recommendation: ONE short, concrete, actionable sentence — a single specific next step the candidate can actually go do, not a restatement of the read above it.

- increase.text/recommendation: what they should do MORE of this week, citing a real number or fact from below (e.g. an outcome count below target, or an incomplete Sprint action).
- adjust.text/recommendation: what needs to change in HOW they're approaching something — citing a real gap, a category that moved down, or a mismatch in the data below. If nothing needs adjusting, say so honestly in text and recommend they keep doing what's working instead.
- maintain.text/recommendation: what's genuinely working and should keep going as-is — citing a real strength, a category that moved up, or a real outcome count that's on pace.
- startNew.text/recommendation: one concrete new thing worth starting — grounded in a real gap or an unused lever from the data below (e.g. calendar meetings at zero, follow-ups piling up, application volume below goal).

Never state a numeric score, never use the words "level rank," "calibrated," or "tier." Be specific — cite the real number or fact, never generic career-advice filler.

Candidate data:
${summary}`

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Partial<Record<keyof WeeklyFocus, Partial<WeeklyFocusSection>>>
    const focus = normalizeWeeklyFocus(parsed)
    if (!focus) return null

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { weeklyFocusGuidance: JSON.stringify(focus), weeklyFocusWeekStartDate: weekStartDate },
    })
    return focus
  } catch (error) {
    console.error('Failed to draft weekly focus for candidate', candidateId, error)
    return null
  }
}

// Validates all four sections have both text and recommendation. A cached
// blob written before the {text, recommendation} split (or a malformed LLM
// response) fails this and is treated as a cache miss, triggering a fresh
// draft rather than rendering a broken card.
function normalizeWeeklyFocus(parsed: Partial<Record<keyof WeeklyFocus, Partial<WeeklyFocusSection>>>): WeeklyFocus | null {
  const keys: (keyof WeeklyFocus)[] = ['increase', 'adjust', 'maintain', 'startNew']
  const sections = {} as WeeklyFocus
  for (const key of keys) {
    const section = parsed[key]
    if (!section?.text || !section?.recommendation) return null
    sections[key] = { text: section.text, recommendation: section.recommendation }
  }
  return sections
}

function parseCachedWeeklyFocus(raw: string | null): WeeklyFocus | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof WeeklyFocus, Partial<WeeklyFocusSection>>>
    return normalizeWeeklyFocus(parsed)
  } catch {
    return null
  }
}
