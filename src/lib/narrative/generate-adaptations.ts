import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

export interface NarrativeAdaptations {
  linkedinHeadline: string // under 120 characters
  linkedinAbout: string // 3 short paragraphs
  resumeSummary: string // 2-3 lines
  emailOpening: string // 1 sentence
  verbal30s: string // ~30-second spoken pitch
  tellMeAboutYourself: string // 2-minute structured answer
}

const PROMPT_PREFIX = `Adapt this candidate's Core Narrative Statement into 6 different surface formats. Every adaptation must stay grounded in the same facts as the core statement below — don't add new claims.

Return strict JSON with this exact shape, no markdown, no extra keys:
{"linkedinHeadline": "...", "linkedinAbout": "...", "resumeSummary": "...", "emailOpening": "...", "verbal30s": "...", "tellMeAboutYourself": "..."}

- linkedinHeadline: under 120 characters, the LinkedIn headline field format (role/focus, not a full sentence).
- linkedinAbout: 3 short paragraphs for a LinkedIn "About" section, first person.
- resumeSummary: 2-3 lines suitable for the top of a resume, no "I" statements (resume style, not first person).
- emailOpening: exactly one sentence, suitable as the opening line of a cold outreach or cover email.
- verbal30s: a natural-sounding ~30-second spoken pitch (about 75-90 words), written to be said out loud, not read.
- tellMeAboutYourself: a fuller ~2-minute structured spoken answer to "tell me about yourself" (past → present → future arc), written to be said out loud.

Core Narrative Statement:
`

export async function generateAdaptations(candidateId: string): Promise<void> {
  const narrative = await prisma.candidateNarrative.findUnique({ where: { candidateId } })
  if (!narrative) return

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: `${PROMPT_PREFIX}${narrative.coreStatement}` }],
  })
  const message = await stream.finalMessage()
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return

  try {
    const parsed = JSON.parse(match[0]) as NarrativeAdaptations
    await prisma.candidateNarrative.update({
      where: { candidateId },
      data: { adaptations: parsed as unknown as object },
    })
  } catch {
    // Malformed JSON from the model — leave the previous adaptations in place.
  }
}
