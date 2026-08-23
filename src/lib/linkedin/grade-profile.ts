import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'

export interface LinkedInFeedbackItem {
  issue: string
  action: string
}

const feedbackItemSchema = z.object({
  issue: z.string(),
  action: z.string(),
})

const linkedInGradeSchema = z.object({
  headlineScore: z.number().int().min(0).max(100),
  headlineFeedback: z.array(feedbackItemSchema).min(2).max(6),
  aboutScore: z.number().int().min(0).max(100),
  aboutFeedback: z.array(feedbackItemSchema).min(2).max(6),
  experienceScore: z.number().int().min(0).max(100),
  experienceFeedback: z.array(feedbackItemSchema).min(2).max(6),
})

// No public LinkedIn profile API exists, so the candidate pastes their own
// profile text rather than this fetching anything live — see
// LinkedInProfileGraderForm. Truncated the same way other paste-in-text
// flows are (find-my-job/actions.ts's job-description paste) to bound the
// prompt size regardless of how much someone pastes.
export const MAX_PASTED_TEXT_LENGTH = 8000

// A new Claude call every submit is a real per-request cost — this is the
// re-grade cooldown enforced in the Server Action (submitLinkedInProfileGrade),
// not here, so a failed/errored attempt can still be retried immediately
// (the cooldown only applies after a completed grade — see analyzedAt).
export const REGRADE_COOLDOWN_DAYS = 7

const PROMPT_PREFIX = `You are grading a LinkedIn profile on three independent dimensions for a candidate actively job searching. Be honest and specific, not encouraging fluff. Each feedback field is a list of 2-6 issues; for EACH issue, phrase it as what a recruiter or hiring manager would actually notice scanning this profile — e.g. "A recruiter scanning this will notice..." — not generic self-improvement language, and pair it with one specific, concrete action to fix it.

1. Headline (0-100): does it go beyond a plain job title to signal what the candidate actually does and the value they bring (e.g. specialty, industry, a real outcome), in a way that would show up well in LinkedIn search and recruiter InMail lists? Score lower for a headline that's just "Job Title at Company" with nothing else.

2. About/Summary section (0-100): does it tell a real, specific professional story — concrete achievements, what the candidate is looking for next — rather than generic filler ("results-driven professional with X years of experience")? Score lower for vague self-description with no specifics.

3. Experience section (0-100): same standard as resume bullets — quantified impact and outcomes (numbers, percentages, concrete results) rather than vague responsibility statements ("responsible for," "helped with"). Score higher for specific, measurable achievements per role.

If a section (headline, About, or experience) is missing entirely from the pasted text, score it low and say plainly in the feedback that it wasn't found in what was pasted — don't invent content to grade.

LinkedIn profile text, as pasted by the candidate:
`

export async function gradeLinkedInProfile(candidateId: string, pastedText: string): Promise<void> {
  const truncated = pastedText.slice(0, MAX_PASTED_TEXT_LENGTH)

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 5000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(linkedInGradeSchema), effort: 'medium' },
      messages: [{ role: 'user', content: `${PROMPT_PREFIX}${truncated}` }],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) {
      await prisma.linkedInProfileGrade.upsert({
        where: { candidateId },
        create: { candidateId, pastedText: truncated, analysisError: 'No analysis returned from the model.' },
        update: { pastedText: truncated, analysisError: 'No analysis returned from the model.', analyzedAt: null },
      })
      return
    }

    await prisma.linkedInProfileGrade.upsert({
      where: { candidateId },
      create: {
        candidateId,
        pastedText: truncated,
        headlineScore: data.headlineScore,
        headlineFeedback: data.headlineFeedback,
        aboutScore: data.aboutScore,
        aboutFeedback: data.aboutFeedback,
        experienceScore: data.experienceScore,
        experienceFeedback: data.experienceFeedback,
        analyzedAt: new Date(),
        analysisError: null,
      },
      update: {
        pastedText: truncated,
        headlineScore: data.headlineScore,
        headlineFeedback: data.headlineFeedback,
        aboutScore: data.aboutScore,
        aboutFeedback: data.aboutFeedback,
        experienceScore: data.experienceScore,
        experienceFeedback: data.experienceFeedback,
        analyzedAt: new Date(),
        analysisError: null,
      },
    })
  } catch (error) {
    const analysisError = error instanceof Error ? error.message : 'LinkedIn profile analysis failed.'
    await prisma.linkedInProfileGrade.upsert({
      where: { candidateId },
      create: { candidateId, pastedText: truncated, analysisError },
      update: { pastedText: truncated, analysisError, analyzedAt: null },
    })
  }
}
