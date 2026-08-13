import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'

export interface HardQuestionAnswers {
  whatHappened: string // casual, honest answer to "so what happened at your last job?"
  whyLooking: string // casual answer to "why are you looking right now?"
  howsItGoing: string // casual answer to "how's the job search going?"
  whatsNext: string // casual answer to "what are you looking for next?"
}

// Deliberately casual register, distinct from Interview Prep's formal,
// role-specific Tough Questions (src/lib/interview-prep/generate-tough-answer.ts)
// — these are the "what do I actually say when someone asks me this at a
// backyard barbecue" questions, not interview-panel answers. Never merged
// with Interview Prep's content.
const PROMPT_PREFIX = `Write casual, honest, spoken-register answers to the "hard questions" a candidate gets asked constantly during a job search — by friends, former colleagues, people at a party, not by an interviewer in a formal interview. These are NOT interview answers — keep them short, plainspoken, a little vulnerable where it's true, and completely free of corporate language ("synergy", "leverage", "results-driven"). Ground every claim in the Core Narrative Statement below — never invent details it doesn't support.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"whatHappened": "...", "whyLooking": "...", "howsItGoing": "...", "whatsNext": "..."}

- whatHappened: a short, honest, no-drama answer to "so what happened at your last job?" — matter-of-fact, not defensive.
- whyLooking: a short answer to "why are you looking for something new right now?"
- howsItGoing: a short, real answer to "how's the job search going?" — upbeat but not fake, okay to be honest that it's work.
- whatsNext: a short answer to "so what are you looking for next?"

Core Narrative Statement:
`

// Prompt 68 §3 calls for routing a caution note to the coach instead of
// generating content when the candidate's "Coach Admin Sensitive Intake"
// (Prompt 57) flagged something that makes self-serve generation
// inappropriate (e.g. a termination or legal matter better handled by a
// human first). That intake feature does not exist anywhere in this
// codebase — confirmed via grep, same gap already documented in
// src/lib/interim-work/expert-network-caution.ts's hasLegalRestrictionFlag().
// Mirrors that stub exactly: returns false unconditionally so the
// coach-routing branch is structurally wired up but never fires until
// Prompt 57 actually exists and a real field can replace this stub.
export async function shouldRouteHardQuestionsToCoach(candidateId: string): Promise<boolean> {
  void candidateId
  return false
}

export async function generateHardQuestions(candidateId: string): Promise<void> {
  const narrative = await prisma.candidateNarrative.findFirst({
    where: { candidateId },
    orderBy: { generatedAt: 'asc' },
  })
  if (!narrative) return

  if (!/[.!?]['"”’]?\s*$/.test(narrative.coreStatement.trim())) {
    console.error(
      'Skipping hard questions for candidate',
      candidateId,
      '— core statement looks truncated:',
      narrative.coreStatement
    )
    return
  }

  let text: string
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${narrative.coreStatement}` }],
    })
    const message = await stream.finalMessage()
    text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  } catch (error) {
    console.error('Failed to generate hard questions for candidate', candidateId, error)
    return
  }

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return

  try {
    const parsed = JSON.parse(match[0]) as HardQuestionAnswers
    await prisma.candidateNarrative.update({
      where: { id: narrative.id },
      data: { hardQuestions: parsed as unknown as object, hardQuestionsGeneratedAt: new Date() },
    })

    // One-time Weekly Sprint bonus — guarded the same way as the other
    // one-time confirm bonuses in this feature (see waysToSayItBonusAt).
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { hardQuestionsBonusAt: true },
    })
    if (profile && !profile.hardQuestionsBonusAt) {
      await prisma.candidateProfile.update({
        where: { id: candidateId },
        data: { hardQuestionsBonusAt: new Date() },
      })
      const sprint = await getCurrentWeekSprint(candidateId)
      if (sprint) {
        const effort = estimateActionEffort({ actionType: 'HARD_QUESTIONS_COMPLETE' })
        await autoCompleteEngagementAction(candidateId, {
          actionType: 'HARD_QUESTIONS_COMPLETE',
          text: 'Get answers to the hard questions',
          points: effort.points,
          estimatedMinutes: effort.minutes,
        })
      }
    }
  } catch {
    // Malformed JSON from the model — leave any previous hardQuestions in place.
  }
}
