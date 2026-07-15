import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { COACH_HISTORY_MESSAGE_LIMIT } from '@/lib/constants/coach'
import { LINKEDIN_POINTS_WINDOW_DAYS } from '@/lib/constants/linkedin'
import { CURRENT_JOB_STATUS_LABELS } from '@/lib/constants/onboarding'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'
import { scoreToGrade, GRADE_LABEL } from '@/lib/scoring/grade'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { computeDirectnessLevel, DIRECTNESS_INSTRUCTION } from '@/lib/scoring/directness-level'

const SYSTEM_PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

You're checking in like a supportive friend who is also honest with them: acknowledge how they're feeling, then help them get concrete about what they'll actually do today. Keep replies short (2-5 sentences), conversational, never generic corporate-speak.

Never cite a raw numeric score (e.g. "72/100") — it reads as falsely precise. If you reference their standing at all, use only the letter grade (A-F) and its label. Not everyone who searches will land a job, but doing the real work — especially on their Search Execution, the part fully in their control — meaningfully improves their odds. Lead with that framing over Market Reality, which reflects conditions largely outside their control.

When it's contextually relevant (don't force it into every reply), encourage two specific behaviors and explain briefly why they help: (1) posting on LinkedIn daily — visibility compounds, recruiters and their network see consistent activity, not just a static profile; (2) liking/commenting on others' posts — it's low-effort, keeps them visible in others' feeds, and often opens conversations. Only bring these up if the candidate's own data below suggests they're not already doing them, or if the conversation naturally turns to job-search strategy.
`

export async function generateCoachReply(
  conversationId: string,
  candidateId: string,
  userMessage: string
): Promise<string> {
  const [candidate, history] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: { linkedInActivityLogs: true, _count: { select: { weeklySprints: true } } },
    }),
    prisma.coachMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: COACH_HISTORY_MESSAGE_LIMIT,
    }),
  ])

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - LINKEDIN_POINTS_WINDOW_DAYS)
  const recentLinkedInPosts = candidate.linkedInActivityLogs.filter((l) => l.loggedAt > windowStart).length

  const weekNumber = candidate._count.weeklySprints + 1
  const directnessLevel = computeDirectnessLevel(weekNumber, isCasuallySearching(candidate.jobSearchIntensity))

  const contextBlock = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Job status: ${candidate.currentJobStatus ? CURRENT_JOB_STATUS_LABELS[candidate.currentJobStatus] : 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Current hireability grade: ${scoreToGrade(candidate.employabilityScore)} (${GRADE_LABEL[scoreToGrade(candidate.employabilityScore)]}) (tier: ${candidate.visibilityTier})
LinkedIn URL on file: ${candidate.linkedInUrl ? 'yes' : 'no'}
LinkedIn posts logged in the last ${LINKEDIN_POINTS_WINDOW_DAYS} days: ${recentLinkedInPosts}
Networking list (25 people) submitted: ${candidate.networkingListSubmittedAt ? 'yes' : 'no'}
Asked someone for help: ${candidate.askedForHelpAt ? 'yes' : 'no'}
`.trim()

  const orderedHistory = [...history].reverse()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      thinking: { type: 'adaptive' },
      system: `${SYSTEM_PROMPT_PREFIX}\n${DIRECTNESS_INSTRUCTION[directnessLevel]}\n\nCandidate context:\n${contextBlock}`,
      messages: [
        ...orderedHistory.map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage },
      ],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return text || "I'm here — tell me a bit more about how today's going?"
  } catch {
    return "I'm having trouble responding right now, but I'm here. Tell me what's on your mind and we'll pick this up again in a moment."
  }
}
