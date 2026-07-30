import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { computeWorkHistoryFacts } from '@/lib/resume/work-history-facts'
import { getDefaultNarrative } from '@/lib/narrative/get-default-narrative'

export interface ResumeFeedbackItem {
  issue: string
  action: string
}

const feedbackItemSchema = z.object({
  issue: z.string(),
  action: z.string(),
})

const resumeAnalysisSchema = z.object({
  atsScore: z.number().int().min(0).max(100),
  atsFeedback: z.array(feedbackItemSchema).min(2).max(6),
  resultsScore: z.number().int().min(0).max(100),
  resultsFeedback: z.array(feedbackItemSchema).min(2).max(6),
  experienceScore: z.number().int().min(0).max(100),
  experienceFeedback: z.array(feedbackItemSchema).min(2).max(6),
})

const PROMPT_PREFIX = `You are grading a resume on three independent dimensions for a candidate targeting a senior/executive-level role. Be honest and specific, not encouraging fluff. Each feedback field is a list of 2-6 issues; for EACH issue, phrase it as what a recruiter or hiring manager would actually notice reviewing this resume — e.g. "A recruiter scanning this will notice..." / "A hiring manager reading this won't find..." — not generic self-improvement language, and pair it with one specific, concrete action to fix it.

1. ATS readability (0-100): how reliably would an Applicant Tracking System parse this resume correctly? Consider: standard section headers (Experience, Education, Skills), no tables/columns/text boxes that break parsers, no images containing text, consistent simple formatting, no unusual fonts/characters.

2. Results orientation (0-100): does the resume show quantified impact and outcomes (numbers, percentages, concrete results) rather than vague responsibility statements ("responsible for," "helped with")? Score higher for specific, measurable achievements.

3. Experience evaluation (0-100): assess employment gaps, job-hopping/tenure patterns, whether past roles/functions/industries align with the candidate's stated goals, and whether the resume's own framing is consistent with the candidate's stated narrative (see "Candidate's stated core narrative" below, if present — flag it as an issue only when the resume's framing actively contradicts that narrative's story, not merely when the narrative says more than the resume does). Trust the "Computed work history facts" block below over your own inference from the resume text — it is deterministic and accurate. Specifically:
   - A gap tagged with a departure reason of COMPANY_WIDE_LAYOFF, DIVISION_ELIMINATED, COMPANY_SHUTDOWN, ACQUISITION_REDUNDANCY, OFFSHORED_OUTSOURCED, CAREGIVER_LEAVE, or SABBATICAL was outside the candidate's control or a planned life event — treat it sympathetically, do not penalize the score for it, and do not call it a red flag.
   - A gap tagged explainedBy: "education" overlaps a degree the candidate was pursuing full-time (e.g. an MBA between two jobs) — do not call this a gap at all, just note the degree as context if relevant.
   - A gap with no departure reason, or one tagged with a reason that reflects a voluntary/ambiguous departure, can be noted neutrally but should not be assumed to be a red flag either — only call out a genuine pattern if there are multiple such gaps.
   - Short average tenure or several sub-12-month roles is worth noting as a job-hopping signal, but explain the "why it matters to employers" framing rather than being punitive.
   - Compare the candidate's past roles/functions/industries against their stated target role, target industries, and primary function — call out strong alignment as a strength, and misalignment as something to address in the resume's positioning (not as a character flaw).
   - If the candidate's most recent or current role title reads as an independent/interim consulting title (e.g. "Consultant," "Independent Consultant," "Freelance Consultant," self-employed advisory work) and it looks like a stopgap rather than a genuine multi-year consulting career (short tenure, or started right after a layoff/gap), flag it explicitly: many recruiters read a "Consultant" title at the top of a resume as a euphemism for being out of work, so the candidate needs specific, concrete client stories (named projects, quantified outcomes) ready to counter that assumption in interviews — not just the title on the page.
   - Compare the candidate's demonstrated seniority (highestLevelReached, teamSizeManaged, lastSalary) against their stated target (targetRoleType, targetCompMin, willingToStartLower). If they are overqualified or at the high end of the pay/seniority range for what they're targeting, say so plainly: the resume will look strong on paper, but it will likely be a tough climb — employers may worry about comp fit or flight risk once a role at the candidate's real level opens up, so the candidate should proactively address "why this level, why this comp" in their positioning rather than let it go unaddressed.

Computed work history facts:
`

export async function analyzeResume(resumeId: string): Promise<void> {
  const resume = await prisma.resume.findUniqueOrThrow({
    where: { id: resumeId },
    include: { candidate: { include: { workHistory: true, educationHistory: true } } },
  })

  if (!resume.extractedText) {
    await prisma.resume.update({
      where: { id: resumeId },
      data: { analysisError: 'No extracted text available to analyze.' },
    })
    return
  }

  const facts = computeWorkHistoryFacts(
    resume.candidate.workHistory.map((entry) => ({
      companyName: entry.companyName,
      roleTitle: entry.roleTitle,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      departureReason: entry.departureReason,
      engagementType: entry.engagementType,
    })),
    resume.candidate.educationHistory.map((entry) => ({
      startDate: entry.startDate,
      graduationDate: entry.graduationDate,
    }))
  )

  const factsBlock = JSON.stringify(
    {
      ...facts,
      targetRoleType: resume.candidate.targetRoleType,
      targetIndustries: resume.candidate.targetIndustries,
      primaryFunction: resume.candidate.primaryFunction,
      industryContext: resume.candidate.industryContext,
      highestLevelReached: resume.candidate.highestLevelReached,
      teamSizeManaged: resume.candidate.teamSizeManaged,
      lastSalary: resume.candidate.lastSalary,
      targetCompMin: resume.candidate.targetCompMin,
      willingToStartLower: resume.candidate.willingToStartLower,
    },
    null,
    2
  )

  const defaultNarrative = await getDefaultNarrative(resume.candidateId)
  const narrativeBlock = defaultNarrative
    ? `\n\nCandidate's stated core narrative: ${defaultNarrative.coreStatement}`
    : ''

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 5000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(resumeAnalysisSchema), effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: `${PROMPT_PREFIX}${factsBlock}${narrativeBlock}\n\nResume text:\n${resume.extractedText}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) {
      await prisma.resume.update({
        where: { id: resumeId },
        data: { analysisError: 'No analysis returned from the model.' },
      })
      return
    }

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        atsScore: data.atsScore,
        atsFeedback: data.atsFeedback,
        resultsScore: data.resultsScore,
        resultsFeedback: data.resultsFeedback,
        experienceScore: data.experienceScore,
        experienceFeedback: data.experienceFeedback,
        analyzedAt: new Date(),
      },
    })
  } catch (error) {
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        analysisError: error instanceof Error ? error.message : 'Resume analysis failed.',
      },
    })
  }
}
