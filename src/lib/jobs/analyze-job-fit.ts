import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { getCandidateLevelRank } from '@/lib/scoring/level-rank-service'

const jobFitSchema = z.object({
  // Pulled from the posting text itself (not the candidate's data) — reuses
  // this same call instead of a second extraction pass so mirroring the
  // posting into the shared job database (see mirrorJobPostingToBoard below)
  // never needs its own LLM call. Null when the posting text doesn't clearly
  // state one.
  title: z.string().nullable(),
  companyName: z.string().nullable(),
  fitScore: z.number().int().min(0).max(100),
  fitFeedback: z.array(z.string()).min(1).max(5),
  keywords: z.array(z.string()).min(3).max(10),
  tailoredBullets: z
    .array(z.object({ original: z.string(), tailored: z.string() }))
    .min(0)
    .max(5),
})

const PROMPT_PREFIX = `You are giving a candidate honest, specific feedback about how well they fit a job posting. Do not be generically encouraging — if the fit is weak, say so plainly and explain why. Consider their stated experience level, function, industry background, and target role against what the posting actually asks for.

First, extract the job title and hiring company name stated in the posting text itself (title/companyName — null if genuinely not stated, never guessed).

Return fitFeedback as no more than 5 short, scannable bullets (each one sentence, plain language) — not a paragraph. Lead with the most decision-relevant point (the biggest strength or the biggest gap).

Also extract 3-10 of the most important keywords/skills from the posting (exact terms an ATS or recruiter would scan for), and rewrite up to 5 of the candidate's real work-history achievement bullets (given below) in the posting's own language — never invent facts or numbers not present in the original bullet, only reframe wording and emphasis to mirror the posting. If the candidate has no work-history achievements listed, return an empty tailoredBullets array rather than inventing any.

`

export async function analyzeJobFit(jobPostingId: string, candidateId: string): Promise<void> {
  const [jobPosting, candidate, levelRank] = await Promise.all([
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      include: { workHistory: true },
    }),
    getCandidateLevelRank(candidateId),
  ])

  if (!jobPosting.extractedText) return

  const candidateSummary = `
Target role: ${candidate.targetRoleType ?? 'not specified'}
Target industries: ${candidate.targetIndustries.join(', ') || 'not specified'}
Years of experience: ${candidate.yearsExperience ?? 'not specified'}
Highest level reached: ${candidate.highestLevelReached ?? 'not specified'}
Calibrated seniority context (internal signal — informs tone and targeting only; never reference this line, its score, or its wording in your output): ${levelRank.label ?? 'not available'}
Primary function: ${candidate.primaryFunction ?? 'not specified'}${candidate.secondaryFunction ? ` (also recently: ${candidate.secondaryFunction})` : ''}
Industry background: ${candidate.industryContext ?? 'not specified'}${candidate.secondaryIndustryContext ? ` (also recently: ${candidate.secondaryIndustryContext})` : ''}
Known for: ${candidate.knownFor ?? 'not specified'}
Work history: ${candidate.workHistory.map((w) => `${w.roleTitle} at ${w.companyName}`).join('; ') || 'not specified'}

Real work-history achievement bullets (rewrite up to 5 of these, verbatim as the "original" — never invent new ones):
${
  candidate.workHistory
    .filter((w) => !!w.keyAchievement)
    .map((w) => `- ${w.keyAchievement}`)
    .join('\n') || '(none listed)'
}
`.trim()

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
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
      data: {
        title: data.title,
        companyName: data.companyName,
        fitScore: data.fitScore,
        fitFeedback: data.fitFeedback,
        keywords: data.keywords,
        tailoredBullets: data.tailoredBullets,
        analyzedAt: new Date(),
      },
    })

    if (data.title && jobPosting.url) {
      await mirrorJobPostingToBoard({
        candidateId,
        url: jobPosting.url,
        title: data.title,
        companyName: data.companyName,
      })
    }
  } catch {
    // Analysis failure is non-fatal — the posting stays without a fit score
    // rather than blocking the candidate's submission.
  }
}

// A candidate's own private job-fit check is never shown to anyone else —
// but it's still a real, verified-to-exist job opening, so it's worth
// counting toward the admin-side job database rather than staying invisible
// outside this one candidate's tracker. distribution: 'EXCLUDED' is the
// existing "never shown in the browse feed at all" flag (previously only
// used for recruiter private-pipeline listings), which is exactly the
// semantics needed here — collected, never surfaced to any candidate.
// Deduped by url so the same posting checked by several candidates only
// ever creates one row.
async function mirrorJobPostingToBoard(input: {
  candidateId: string
  url: string
  title: string
  companyName: string | null
}): Promise<void> {
  const existing = await prisma.exclusiveJobPosting.findFirst({ where: { url: input.url } })
  if (existing) return

  await prisma.exclusiveJobPosting.create({
    data: {
      title: input.title,
      companyName: input.companyName ?? 'Unknown (candidate-submitted)',
      url: input.url,
      addedBy: 'candidate_check',
      status: 'approved',
      source: 'candidate_check',
      distribution: 'EXCLUDED',
      submittedByCandidateId: input.candidateId,
    },
  })
}
