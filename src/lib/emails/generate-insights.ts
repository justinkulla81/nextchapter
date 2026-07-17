import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

Write a short daily email to this candidate as Victoria. The goal is intrigue, not information — this email should make them curious enough to open the dashboard, not tell them everything up front.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"subject": "...", "bullets": ["...", "...", "..."]}

Rules:
- "subject" is a short, specific email subject line (under 60 characters). It should create curiosity about what's inside, not summarize it.
- "bullets" is exactly 3 short items (one sentence each), each grounded in a real, specific detail from the candidate's data below — never generic filler.
- Never mention any letter grade, numeric score, percentage, or the name of a scoring dimension/engine (e.g. never say "Search Action Grade", "Working Engine", "Connecting Engine", or similar).
- Never repeat today's action verbatim in a bullet — the CTA button already says what to do; the bullets should build curiosity about why, not restate the task.

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
  strengths: { title: string; detail: string }[]
  weaknesses: { title: string; detail: string }[]
}): Promise<DailyInsights | null> {
  const summary = `
Name: ${context.firstName ?? 'not given'}
Current daily streak: ${context.currentStreak} day(s)
Today's planned action: ${context.primaryActionText ?? 'none set'}
Strengths: ${context.strengths.map((s) => `${s.title} — ${s.detail}`).join('; ') || 'none recorded yet'}
Areas to work on: ${context.weaknesses.map((w) => `${w.title} — ${w.detail}`).join('; ') || 'none recorded yet'}
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
