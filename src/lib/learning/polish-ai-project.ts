import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'

// Turns a candidate's rough description of an AI project into a tight,
// concrete proof statement suitable for the Dossier — the same "use AI to
// articulate your AI-fluency proof" loop the feature is trying to validate.
// Falls back to the raw input if generation fails; never blocks the save.
export async function polishAiProjectDescription(input: {
  title: string
  toolUsed: string
  rawDescription: string
}): Promise<string> {
  const client = getAnthropicClient()
  const prompt = `Rewrite this candidate's description of an AI project they built into 1-2 tight, concrete sentences suitable for a hiring document. Keep every specific fact (numbers, tools, outcomes) — do not invent anything not present in the input. No hype, no adjectives doing the work of a fact.

Project title: ${input.title}
Tool used: ${input.toolUsed}
Candidate's raw description: ${input.rawDescription}`

  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
    return text || input.rawDescription
  } catch {
    return input.rawDescription
  }
}
