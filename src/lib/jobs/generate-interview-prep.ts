import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

const interviewPrepSchema = z.object({
  likelyQuestions: z.array(z.string()).min(3).max(8),
  talkingPoints: z.array(z.string()).min(3).max(8),
  questionsToAsk: z.array(z.string()).min(2).max(5),
})

const PROMPT_PREFIX = `A candidate landed an interview for this job posting. Prepare them with honest, specific interview prep grounded in the actual job posting text and their real background — no generic interview advice.

1. Likely questions (3-8): interview questions this specific role/posting will probably ask, based on its stated requirements/responsibilities.
2. Talking points (3-8): specific moments from the candidate's own background (work history, achievements) they should bring up, and why each connects to what this posting is asking for.
3. Questions to ask (2-5): smart questions THEY should ask the interviewer, specific to this posting/company, not generic "what's the culture like" filler.

`

export async function generateInterviewPrep(jobPostingId: string, candidateId: string): Promise<void> {
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
      data: { interviewPrepError: 'No job posting text available to prepare from.' },
    })
    return
  }

  const candidateSummary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`).join('; ') || 'not specified'}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(interviewPrepSchema), effort: 'medium' },
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
        data: { interviewPrepError: 'No prep returned from the model.' },
      })
      return
    }

    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { interviewPrep: data, interviewPrepAnalyzedAt: new Date() },
    })
  } catch (error) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: {
        interviewPrepError: error instanceof Error ? error.message : 'Interview prep generation failed.',
      },
    })
  }
}
