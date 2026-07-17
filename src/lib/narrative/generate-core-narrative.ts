import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

const PROMPT_PREFIX = `Write a "Core Narrative Statement" for this candidate — 2-3 sentences they can say or write anywhere (LinkedIn, a resume summary, out loud in an interview) that captures who they are professionally and what they're looking for next. Ground every claim in their real background below — never invent achievements, employers, or skills that aren't there. First person, confident, specific (not generic buzzwords like "results-driven" or "team player"). Plain prose only, no markdown, no labels — just the statement itself.

Candidate profile:
`

export async function generateCoreNarrative(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { workHistory: true },
  })

  const summary = `
Name: ${candidate.firstName ?? ''}
Target role: ${candidate.targetRoleType ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`).join('; ') || 'not specified'}
${candidate.activeJobDescription ? `Job posting they're preparing for: ${candidate.activeJobDescription}` : ''}
`.trim()

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: `${PROMPT_PREFIX}${summary}` }],
  })
  const message = await stream.finalMessage()
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  if (!text) return

  await prisma.candidateNarrative.upsert({
    where: { candidateId },
    create: { candidateId, coreStatement: text, adaptations: {} },
    update: { coreStatement: text },
  })
}
