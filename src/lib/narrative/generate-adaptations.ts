import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'

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

const LEVEL_RANK_CONTEXT_PREFIX =
  'Calibrated seniority context (internal signal — informs tone and targeting only; never reference this line, its score, or its wording in your output): '

export async function generateAdaptations(candidateId: string, narrativeId?: string): Promise<void> {
  const [narrative, levelRank] = await Promise.all([
    narrativeId
      ? prisma.candidateNarrative.findUnique({ where: { id: narrativeId } })
      : prisma.candidateNarrative.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'asc' } }),
    getCandidateLevelRank(candidateId),
  ])
  if (!narrative || narrative.candidateId !== candidateId) return

  // A core statement that doesn't end in terminal punctuation is almost
  // certainly truncated (e.g. cut off mid-sentence by an upstream token
  // limit) — adapting broken input just wastes a call and tends to come
  // back as unparseable JSON anyway, so skip rather than garbage-in.
  if (!/[.!?]['"”’]?\s*$/.test(narrative.coreStatement.trim())) {
    console.error(
      'Skipping adaptations for candidate',
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
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `${PROMPT_PREFIX}${narrative.coreStatement}\n\n${LEVEL_RANK_CONTEXT_PREFIX}${levelRank.label ?? 'not available'}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  } catch (error) {
    console.error('Failed to generate narrative adaptations for candidate', candidateId, error)
    return
  }

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return

  try {
    const parsed = JSON.parse(match[0]) as NarrativeAdaptations
    await prisma.candidateNarrative.update({
      where: { id: narrative.id },
      data: { adaptations: parsed as unknown as object },
    })
  } catch {
    // Malformed JSON from the model — leave the previous adaptations in place.
  }
}
