import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { computeYearsExperienceFromResume } from '@/lib/resume/work-history-facts'

const profileFieldsSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  educationSummary: z.string().nullable(),
  graduationDate: z.string().nullable(), // ISO date string, e.g. "2018-05-15"
  firstJobStartDate: z.string().nullable(), // ISO date string
  latestJobTitle: z.string().nullable(),
  industry: z.string().nullable(),
  primaryFunction: z.enum(PRIMARY_FUNCTION_OPTIONS).nullable(),
  aiReadinessScore: z.number().int().min(0).max(100).nullable(),
  aiReadinessNotes: z.string().nullable(),
})

const PROMPT_PREFIX = `Extract the following fields from this resume. Only extract what is explicitly present in the text — never fabricate or guess a value that isn't there; use null instead.

- firstName, lastName: from the resume header/contact info.
- email, phone, streetAddress, city, state, country: from contact info, if present.
- educationSummary: a short one-line summary of their highest degree + institution (e.g. "MBA, Stanford Graduate School of Business").
- graduationDate: the graduation date of their most recent/highest degree, as an ISO date (YYYY-MM-DD). If only a year is given, use YYYY-01-01.
- firstJobStartDate: the start date of their EARLIEST listed job (their first job after school), as an ISO date. If only a year is given, use YYYY-01-01.
- latestJobTitle: their most recent job title.
- industry: the industry of their most recent employer, in a few words.
- primaryFunction: their primary functional area, constrained to one of the provided categories.
- aiReadinessScore (0-100) and aiReadinessNotes: assess how "AI-ready" this resume signals the candidate is — mentions of AI tools, automation, LLM usage, building with AI, etc. This is being captured for future use, not for immediate scoring — be honest and specific in the notes.

Resume text:
`

export async function extractProfileFieldsFromResume(resumeId: string): Promise<void> {
  const resume = await prisma.resume.findUniqueOrThrow({ where: { id: resumeId } })

  if (!resume.extractedText) return

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(profileFieldsSchema), effort: 'medium' },
      messages: [{ role: 'user', content: PROMPT_PREFIX + resume.extractedText }],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) return

    const graduationDate = data.graduationDate ? new Date(data.graduationDate) : null
    const firstJobStartDate = data.firstJobStartDate ? new Date(data.firstJobStartDate) : null
    const yearsExperience = computeYearsExperienceFromResume(graduationDate, firstJobStartDate)

    await prisma.candidateProfile.update({
      where: { id: resume.candidateId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        streetAddress: data.streetAddress,
        currentCity: data.city,
        currentState: data.state,
        currentCountry: data.country ?? undefined,
        graduationDate,
        resumeFirstJobStartDate: firstJobStartDate,
        resumeLatestJobTitle: data.latestJobTitle,
        industryContext: data.industry,
        primaryFunction: data.primaryFunction,
        yearsExperience,
        resumeAiReadinessScore: data.aiReadinessScore,
        resumeAiReadinessNotes: data.aiReadinessNotes,
      },
    })
  } catch {
    // Best-effort auto-fill — failure here must never block the resume
    // upload or its ATS/results/experience analysis.
  }
}
