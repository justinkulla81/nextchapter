import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { VICTORIA_VOICE_PROMPT } from '@/lib/victoria'

const PROMPT_PREFIX = `${VICTORIA_VOICE_PROMPT}

Coach this candidate through answering a tough interview question honestly and strategically — not with a script to memorize, but a real answer grounded in their actual background below. Write it as the answer the candidate would give (first person, as them, not as Victoria talking about them), 3-5 sentences, direct and specific. Never suggest they lie, badmouth a former employer, or dodge the question — the point is to name the real thing honestly in a way that doesn't sink them. Plain prose only, no markdown.

Candidate background:
`

export async function generateToughAnswer(candidateId: string, question: string): Promise<string | null> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { workHistory: true },
  })

  const summary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Current job status: ${candidate.currentJobStatus ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`).join('; ') || 'not specified'}
${candidate.activeJobDescription ? `Job posting they're interviewing for: ${candidate.activeJobDescription}` : ''}

Question: ${question}
`.trim()

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 600,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: `${PROMPT_PREFIX}${summary}` }],
  })
  const message = await stream.finalMessage()
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  return text || null
}
