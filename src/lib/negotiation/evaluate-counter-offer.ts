import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'

const counterOfferEvaluationSchema = z.object({
  overallAssessment: z.string(),
  strengths: z.array(z.string()).max(4),
  improvements: z.array(z.string()).max(4),
  clarityNote: z.string(),
})

export type CounterOfferEvaluation = z.infer<typeof counterOfferEvaluationSchema>

const PROMPT_PREFIX = `A candidate is practicing what they'd actually say or write to negotiate a job offer. Give them honest, specific feedback — no generic "great job!" filler.

1. overallAssessment: one or two sentences on whether this reads as confident and professional, or hesitant/apologetic/vague.
2. strengths (0-4): what's genuinely working — specific asks, good grounding in their own value, clear structure.
3. improvements (0-4): what to sharpen — vague asks, missing a specific number/timeline, over-apologizing, burying the actual request.
4. clarityNote: one sentence on whether someone reading this would know exactly what the candidate is asking for.

Ground your feedback in the specific talking points and considerations already generated for this offer, noted below — flag if the candidate's draft ignores strong leverage points that were already surfaced to them.

`

export async function evaluateCounterOffer(
  draftText: string,
  context: { talkingPoints: string[]; considerations: string[]; scriptOpening: string }
): Promise<CounterOfferEvaluation | null> {
  const client = getAnthropicClient()
  const contextBlock = `Talking points already surfaced to this candidate: ${context.talkingPoints.join('; ')}
Considerations already surfaced: ${context.considerations.join('; ')}
Suggested opening script: ${context.scriptOpening}`

  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 800,
    thinking: { type: 'disabled' },
    output_config: { format: zodOutputFormat(counterOfferEvaluationSchema) },
    messages: [
      {
        role: 'user',
        content: `${PROMPT_PREFIX}${contextBlock}\n\nCandidate's draft:\n${draftText}`,
      },
    ],
  })
  const message = await stream.finalMessage()
  return message.parsed_output
}
