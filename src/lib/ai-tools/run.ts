import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { reserveFreeAiCall } from '@/lib/ai-spend/reserve'
import { CAP_MESSAGE } from '@/lib/ai-spend/cap'
import { captureServerEvent } from '@/lib/posthog/server'

// The one place a free, no-account page calls a model. The cheapest model the repo already uses, a fixed small output, a
// reserved slot under the spend cap, and the token counts logged and sent to PostHog so real cost per use is visible.

export const FREE_AI_MODEL = 'claude-haiku-4-5-20251001'

export type FreeAiResult = { ok: true; text: string } | { ok: false; error: string }

export async function runFreeAi(opts: { tool: string; system: string; user: string; maxTokens: number }): Promise<FreeAiResult> {
  const slot = await reserveFreeAiCall(opts.tool)
  if (!slot.ok) return { ok: false, error: CAP_MESSAGE[slot.reason] }
  try {
    const message = await getAnthropicClient().messages.create({
      model: FREE_AI_MODEL,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    })
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    console.log(`[free-ai] ${opts.tool} in=${message.usage.input_tokens} out=${message.usage.output_tokens}`)
    captureServerEvent(`free-ai-${crypto.randomUUID()}`, 'free_ai_tool_run', { tool: opts.tool, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, model: FREE_AI_MODEL })
    return { ok: true, text }
  } catch (error) {
    console.error(`Free AI tool ${opts.tool} failed:`, error instanceof Error ? error.message : error)
    await slot.release?.()
    return { ok: false, error: 'Something went wrong on our side. Try again in a minute.' }
  }
}
