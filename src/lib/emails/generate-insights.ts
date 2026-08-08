import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

Write a short daily email to this candidate as Victoria. They already know their own background — never recite their strengths, and never mention specific past employers, companies, or resume facts, even if they appear in the data below (extract the underlying behavior pattern only, never repeat the specifics). This email is about today and what's next, not a review of who they are.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"subject": "...", "bullets": ["...", "...", "..."]}

Rules:
- "subject" needs a real hook — a specific angle or question pulled from today's data, not a flat description or generic phrase ("Your daily update", "Time to take action", "Your one thing for today"). Under 60 characters.
- "bullets" is exactly 3 short items, one sentence each:
  1. If today's planned action is set, open by genuinely encouraging them on that specific action — why it's the right move today. Do not restate the action verbatim (the CTA button already names it) — encourage the reasoning or payoff behind it. If no action is set yet, instead remind them in one sentence what they're actually working toward and why that's worth showing up for today.
  2. Take the one opportunity area in the data below and frame it as something they already know matters and now have a clear, doable way to move on — never as a deficiency, gap, or weakness, and never as a citation of their history.
  3. A short line making clear Victoria/NextChapter is in this with them — we're here to help, not just tracking them.
- Never mention any letter grade, numeric score, percentage, or the name of a scoring dimension/engine (e.g. never say "Current Market Reality", "Working Engine", "Connecting Engine", or similar).

Candidate data:
`

export interface DailyInsights {
  subject: string
  bullets: [string, string, string]
}

function isDailyInsights(value: unknown): value is DailyInsights {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.subject === 'string' &&
    Array.isArray(v.bullets) &&
    v.bullets.length === 3 &&
    v.bullets.every((b) => typeof b === 'string')
  )
}

export async function generateDailyInsights(context: {
  firstName: string | null
  currentStreak: number
  primaryActionText: string | null
  targetFunction: string | null
  opportunity: { title: string; detail: string } | null
}): Promise<DailyInsights | null> {
  const summary = `
Name: ${context.firstName ?? 'not given'}
Current daily streak: ${context.currentStreak} day(s)
Today's planned action: ${context.primaryActionText ?? 'none set yet'}
What they're working toward: ${context.targetFunction ?? 'not specified'}
Opportunity area (frame as a doable opportunity, never as a weakness, and never cite specific companies/employers even if named below): ${context.opportunity ? `${context.opportunity.title} — ${context.opportunity.detail}` : 'none recorded yet'}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${summary}` }],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0])
    return isDailyInsights(parsed) ? parsed : null
  } catch (error) {
    console.error('Failed to generate daily insights:', error)
    return null
  }
}
