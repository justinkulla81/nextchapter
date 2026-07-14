import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

const jobFitSchema = z.object({
  fitScore: z.number().int().min(0).max(100),
  fitFeedback: z.string(),
})

const PROMPT_PREFIX = `You are giving a candidate honest, specific feedback about how well they fit a job posting. Do not be generically encouraging — if the fit is weak, say so plainly and explain why. Consider their stated experience level, function, industry background, and target role against what the posting actually asks for.

`

export async function analyzeJobFit(jobPostingId: string, candidateId: string): Promise<void> {
  const [jobPosting, candidate] = await Promise.all([
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: { workHistory: true },
    }),
  ])

  if (!jobPosting.extractedText) return

  const candidateSummary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Target industries: ${candidate.targetIndustries.join(', ') || 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Industry background: ${candidate.industryContext ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}`).join('; ') || 'not specified'}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(jobFitSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: `${PROMPT_PREFIX}Candidate profile:\n${candidateSummary}\n\nJob posting text:\n${jobPosting.extractedText}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) return

    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { fitScore: data.fitScore, fitFeedback: data.fitFeedback, analyzedAt: new Date() },
    })
  } catch {
    // Analysis failure is non-fatal — the posting stays without a fit score
    // rather than blocking the candidate's submission.
  }
}
