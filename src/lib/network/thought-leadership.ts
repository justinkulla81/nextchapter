import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'

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

export async function draftPost(candidateId: string, idea: PostIdea): Promise<string> {
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

Draft a real LinkedIn post (150-250 words, first person, no hashtags spam, at most 2 relevant hashtags at the end) for this idea:

Title: ${idea.title}
Angle: ${idea.angle}

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
