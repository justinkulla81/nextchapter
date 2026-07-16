'use server'

import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { captureServerEvent } from '@/lib/posthog/server'

export type CalibrationFormState = { error?: string; memo?: string } | undefined

const PROMPT_PREFIX = `A recruiter has pasted a client brief for an open role below. Write a short calibration memo (plain text, no markdown headers) that:
1. Flags any requirements that are redundant (e.g. a degree requirement stacked on top of a very high years-of-experience requirement — do they need both?)
2. Flags any requirements that conflict with each other (e.g. wanting an entrepreneurial builder but also requiring only large, established-company backgrounds)
3. Notes whether the stated compensation looks consistent with the requested background and level, or looks mismatched
4. Suggests adjacent candidate profiles the recruiter may be overlooking, based on what's actually needed vs. what's literally stated

Ground everything strictly in what's actually written in the brief below — do not invent requirements that aren't there. Do NOT attempt to estimate what percentage of a candidate pool any requirement removes — that requires data this tool doesn't have access to; simply do not mention pool-size percentages at all.

Client brief:
`

export async function generateCalibrationMemo(
  token: string,
  _prevState: CalibrationFormState,
  formData: FormData
): Promise<CalibrationFormState> {
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) return { error: 'This link is not valid.' }

  const briefText = (formData.get('brief') as string | null)?.trim()
  if (!briefText || briefText.length < 20) {
    return { error: 'Paste a bit more detail about the role — a couple of sentences at least.' }
  }

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${briefText.slice(0, 8000)}` }],
    })
    const message = await stream.finalMessage()
    const memo = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    if (!memo) return { error: 'Something went wrong generating the memo. Please try again.' }

    captureServerEvent(recruiter.id, 'calibration_memo_generated')

    return { memo }
  } catch {
    return { error: 'Something went wrong generating the memo. Please try again.' }
  }
}
