import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import type { AreaSummary, InterviewArea, InterviewQuestion, SavedAnswer } from './areas'

// Two small model calls for Find your strengths: one follow-up per answer (the drill-down), and one summary per area.
// Both are Haiku with low effort; a failure returns null and the flow carries on without it.
const MODEL = 'claude-haiku-5-5'

const followSchema = z.object({ followUp: z.string().nullable() })

export async function followUpFor(area: InterviewArea, q: InterviewQuestion, answer: string, earlier: SavedAnswer[]): Promise<string | null> {
  try {
    const stream = getAnthropicClient().messages.stream({
      model: MODEL,
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(followSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `You are a warm, sharp career coach helping a job seeker find what they are best at. They answered one question in the area "${area.title}". Ask ONE follow-up that drills down, so the answer becomes something they could say in an interview.

${earlier.length ? `Earlier in this area:\n${earlier.map((e) => `Q: ${e.question}\nA: ${e.answer}${e.followUpAnswer ? `\nMore: ${e.followUpAnswer}` : ''}`).join('\n')}\n\n` : ''}Question: ${q.text}
Answer: ${answer}

Rules:
- ${q.kind === 'strength' ? 'Ask for what is missing: a specific moment or example, what they did themselves (not the team), the result (a number, a before and after, what someone said), or the skill underneath it. Pick the one gap that matters most.' : 'Be kind. Ask what it has cost them, how they work around it, or what they are doing about it. Never make them feel judged.'}
- Refer to something they actually said, in their words.
- Under 25 words, plain language, one question, no preamble, no praise.
- If the answer is already specific (a concrete example and a result), or is empty or nonsense, return followUp: null.`,
        },
      ],
    })
    const out = (await stream.finalMessage()).parsed_output
    const f = out?.followUp?.trim()
    return f ? f.slice(0, 300) : null
  } catch (error) {
    console.error('Find your strengths: follow-up failed', error)
    return null
  }
}

const summarySchema = z.object({ strength: z.string(), proof: z.string(), watchOut: z.string().nullable(), sayIt: z.string() })

export async function summarizeArea(area: InterviewArea, answers: SavedAnswer[]): Promise<AreaSummary | null> {
  try {
    const stream = getAnthropicClient().messages.stream({
      model: MODEL,
      max_tokens: 600,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(summarySchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `A job seeker answered questions about "${area.title}". Name what they are best at here, in plain words they would recognise, using only what they said. No clichés ("results-driven", "passionate", "team player"), no claims they did not make.

${answers.map((e) => `Q: ${e.question}\nA: ${e.answer}${e.followUp ? `\nFollow-up: ${e.followUp}\nA: ${e.followUpAnswer ?? '(skipped)'}` : ''}`).join('\n\n')}

Return:
- strength: under 12 words, the strength itself (e.g. "Getting stalled programs moving again").
- proof: one sentence, the most concrete evidence from their answers, as a fact.
- watchOut: one kind sentence on the weaker spot they described and how to handle it in a job search, or null if they described none.
- sayIt: one first-person sentence, under 30 words, they could say in an interview or to a contact. Natural, spoken, specific.`,
        },
      ],
    })
    const out = (await stream.finalMessage()).parsed_output
    if (!out?.strength?.trim()) return null
    return { strength: out.strength.trim(), proof: out.proof.trim(), watchOut: out.watchOut?.trim() || null, sayIt: out.sayIt.trim() }
  } catch (error) {
    console.error('Find your strengths: summary failed', error)
    return null
  }
}
