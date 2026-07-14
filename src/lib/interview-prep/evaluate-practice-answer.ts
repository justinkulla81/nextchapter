import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'

export interface PracticeEvaluation {
  strengths: string[] // 1-3 short specific things done well
  improvements: string[] // 1-3 short specific things to improve
  usesStarStructure: boolean
  lengthNote: string // one short note on whether the answer was too short/long/about right
}

const PROMPT_PREFIX = `Evaluate this candidate's spoken interview answer. Be honest and specific — this is practice, not a performance review with stakes. Check: does it have real content (specifics, not generalities)? Does it follow a STAR-like structure (situation/task, action, result)? Is the length appropriate for a spoken answer (roughly 60-90 seconds if read aloud — too short reads as underprepared, too long loses the interviewer)? Does it sound authentic, not rehearsed or generic?

Return strict JSON with this exact shape, no markdown, no extra keys:
{"strengths": ["...", "..."], "improvements": ["...", "..."], "usesStarStructure": true, "lengthNote": "..."}

- strengths: 1-3 short, specific things the answer does well.
- improvements: 1-3 short, specific, actionable things to improve — never vague ("be more confident").
- usesStarStructure: true only if there's a clear situation/task, action, and result.
- lengthNote: one short sentence on the length (e.g. "About right for a spoken answer." or "This would run long out loud — trim the setup.").

Question asked: `

export async function evaluatePracticeAnswer(
  question: string,
  answerText: string,
  jobDescription?: string | null
): Promise<PracticeEvaluation | null> {
  const jobContext = jobDescription ? `\n\nJob posting they're preparing for:\n${jobDescription}` : ''
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 800,
    thinking: { type: 'adaptive' },
    messages: [
      { role: 'user', content: `${PROMPT_PREFIX}${question}\n\nCandidate's answer:\n${answerText}${jobContext}` },
    ],
  })
  const message = await stream.finalMessage()
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0]) as PracticeEvaluation
  } catch {
    return null
  }
}
