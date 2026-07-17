import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

const PROMPT_PREFIX = `Write a cover letter for this candidate, tailored specifically to this job posting. Ground every claim in their actual background below — never invent achievements, employers, or skills that aren't there. Keep it to 3-4 short paragraphs: an opening that names the role and why it fits, 1-2 paragraphs connecting specific real experience to what the posting asks for, and a brief closing. Plain prose only — no markdown, no placeholder brackets like "[Company Name]" (use the real company/role from the posting text). If the posting doesn't name a company, refer to "your team" instead of guessing.

`

export async function generateCoverLetter(jobPostingId: string, candidateId: string): Promise<void> {
  const [jobPosting, candidate, latestResume] = await Promise.all([
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: { workHistory: true },
    }),
    prisma.resume.findFirst({
      where: { candidateId, extractedText: { not: null } },
      orderBy: { uploadedAt: 'desc' },
    }),
  ])

  if (!jobPosting.extractedText) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { coverLetterError: 'No job posting text available to draft from.' },
    })
    return
  }

  const candidateSummary = `
Name: ${candidate.firstName ?? ''} ${candidate.lastName ?? ''}
Target role: ${candidate.targetRoleType ?? 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}${w.keyAchievement ? ` — ${w.keyAchievement}` : ''}`).join('; ') || 'not specified'}
${latestResume?.extractedText ? `\nResume text:\n${latestResume.extractedText.slice(0, 4000)}` : ''}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `${PROMPT_PREFIX}Candidate profile:\n${candidateSummary}\n\nJob posting text:\n${jobPosting.extractedText}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    if (!text) {
      await prisma.jobPosting.update({
        where: { id: jobPostingId },
        data: { coverLetterError: 'No cover letter returned from the model.' },
      })
      return
    }

    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { coverLetter: text, coverLetterError: null, coverLetterGeneratedAt: new Date() },
    })
  } catch (error) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: {
        coverLetterError: error instanceof Error ? error.message : 'Cover letter generation failed.',
      },
    })
  }
}
