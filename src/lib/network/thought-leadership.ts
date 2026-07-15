import 'server-only'
import { z } from 'zod'
import type { ContentVenue } from '@prisma/client'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'

// Venue-specific formatting instructions — the same underlying idea/angle
// gets drafted very differently depending on where it's actually going.
const VENUE_INSTRUCTIONS: Record<ContentVenue, string> = {
  LINKEDIN:
    'Format: a LinkedIn post, 150-250 words, first person, short punchy paragraphs (1-2 sentences each), at most 2 relevant hashtags at the very end.',
  SUBSTACK:
    'Format: a Substack/newsletter piece, 400-600 words, more narrative and reflective than a social post — a real opening hook, 2-3 developed paragraphs, a closing thought. No hashtags.',
  PODCAST:
    'Format: a talking-points outline for recording a short podcast segment (not a written post) — a suggested opening line, then 3-5 bullet points covering what to say and in what order, plus one closing thought. Conversational, not a script to read verbatim.',
  INSTAGRAM_FACEBOOK_YOUTUBE:
    'Format: a short social caption, 100-150 words, casual and punchy, plus one bracketed note suggesting a visual or hook for the post/video, and 3-5 relevant hashtags at the end.',
}

const postIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        angle: z.string(),
      })
    )
    .length(5),
})

export interface PostIdea {
  title: string
  angle: string
}

export async function generatePostIdeas(candidateId: string): Promise<PostIdea[]> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { workHistory: true },
  })

  const summary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Target industries: ${candidate.targetIndustries.length > 0 ? candidate.targetIndustries.join(', ') : 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${
    candidate.workHistory
      .map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`)
      .join('; ') || 'none listed'
  }
`.trim()

  const prompt = `${VICTORIA_VOICE_PROMPT}

Generate exactly 5 LinkedIn post ideas genuinely grounded in this candidate's real work history and background below — not generic career advice, not "share an article" filler. Each idea needs a short title and a one-sentence angle describing what makes it worth writing.

Candidate data:
${summary}`

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(postIdeasSchema), effort: 'medium' },
    messages: [{ role: 'user', content: prompt }],
  })
  const message = await stream.finalMessage()
  return message.parsed_output?.ideas ?? []
}

export async function draftPost(candidateId: string, idea: PostIdea, venue: ContentVenue): Promise<string> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { workHistory: true },
  })

  const summary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${
    candidate.workHistory
      .map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`)
      .join('; ') || 'none listed'
  }
`.trim()

  const prompt = `${VICTORIA_VOICE_PROMPT}

Draft real content for this idea:

Title: ${idea.title}
Angle: ${idea.angle}

${VENUE_INSTRUCTIONS[venue]}

Ground it in the candidate's real background below — specific details, not generic advice. Write it so the candidate can lightly edit and post it as their own voice.

Candidate data:
${summary}`

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1200,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })
  const message = await stream.finalMessage()
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
