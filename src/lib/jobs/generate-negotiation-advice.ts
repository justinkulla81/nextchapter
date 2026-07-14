import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

const negotiationAdviceSchema = z.object({
  talkingPoints: z.array(z.string()).min(3).max(8),
  scriptOpening: z.string(),
  considerations: z.array(z.string()).min(2).max(6),
})

const PROMPT_PREFIX = `A candidate received a job offer for this posting. Give them honest, specific negotiation advice — no generic "just ask for more" filler.

1. Talking points (3-8): specific leverage points grounded in their real background and this role's requirements (skills that are in-demand for this posting, relevant achievements, market context if evident from the posting).
2. Script opening: a single ready-to-use opening line/paragraph they could actually say or write to open a negotiation conversation professionally and confidently.
3. Considerations (2-6): things beyond base salary worth negotiating or weighing (equity, signing bonus, start date, remote/hybrid flexibility, title, review timeline) — specific to what's plausible for this kind of role, not a generic checklist.

`

export async function generateNegotiationAdvice(jobPostingId: string, candidateId: string): Promise<void> {
  const [jobPosting, candidate] = await Promise.all([
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: { workHistory: true },
    }),
  ])

  if (!jobPosting.extractedText) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { negotiationAdviceError: 'No job posting text available to advise from.' },
    })
    return
  }

  const candidateSummary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Target comp minimum: ${candidate.targetCompMin ?? 'not specified'}
Last salary: ${candidate.lastSalary ?? 'not specified'}
Comp flexible: ${candidate.compFlexible ? 'yes' : 'no'}
Equity important: ${candidate.equityImportant ? 'yes' : 'no'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`).join('; ') || 'not specified'}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(negotiationAdviceSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: `${PROMPT_PREFIX}Candidate profile:\n${candidateSummary}\n\nJob posting text:\n${jobPosting.extractedText}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) {
      await prisma.jobPosting.update({
        where: { id: jobPostingId },
        data: { negotiationAdviceError: 'No advice returned from the model.' },
      })
      return
    }

    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { negotiationAdvice: data, negotiationAdviceAnalyzedAt: new Date() },
    })
  } catch (error) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: {
        negotiationAdviceError: error instanceof Error ? error.message : 'Negotiation advice generation failed.',
      },
    })
  }
}
