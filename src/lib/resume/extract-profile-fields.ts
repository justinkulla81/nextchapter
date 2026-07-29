import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { computeYearsExperienceFromResume } from '@/lib/resume/work-history-facts'
import { syncResumeEducation } from '@/lib/resume/sync-resume-education'
import { syncResumeWorkHistory } from '@/lib/resume/sync-resume-work-history'
import { computeStructuralFlags } from '@/lib/resume/compute-structural-flags'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { captureServerEvent } from '@/lib/posthog/server'

const HIGHEST_EDUCATION_LEVELS = [
  'SOME_COLLEGE', 'ASSOCIATE', 'BACHELORS', 'MASTERS', 'MBA', 'MPH',
  'JD', 'MD', 'DO', 'PHARMD', 'DDS', 'DVM', 'PSYD', 'PHD', 'OTHER',
] as const

const profileFieldsSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  education: z
    .array(
      z.object({
        schoolName: z.string(),
        degree: z.string().nullable(),
        fieldOfStudy: z.string().nullable(),
        graduationDate: z.string().nullable(), // ISO date string
      })
    )
    .max(6),
  highestEducationLevel: z.enum(HIGHEST_EDUCATION_LEVELS).nullable(),
  employers: z
    .array(
      z.object({
        companyName: z.string(),
        roleTitle: z.string(),
        startDate: z.string().nullable(), // ISO date string
        endDate: z.string().nullable(), // ISO date string, null if current
        isCurrent: z.boolean(),
        companyIndustry: z.string().nullable(),
      })
    )
    .max(12),
  graduationDate: z.string().nullable(), // ISO date string, e.g. "2018-05-15"
  firstJobStartDate: z.string().nullable(), // ISO date string
  latestJobTitle: z.string().nullable(),
  industry: z.string().nullable(),
  primaryFunction: z.enum(PRIMARY_FUNCTION_OPTIONS).nullable(),
  aiReadinessScore: z.number().int().min(0).max(100).nullable(),
  aiReadinessNotes: z.string().nullable(),
  resumeKeywords: z.array(z.string()).max(15),
})

const PROMPT_PREFIX = `Extract the following fields from this resume. Only extract what is explicitly present in the text — never fabricate or guess a value that isn't there; use null instead.

- firstName, lastName: from the resume header/contact info.
- email, phone, streetAddress, city, state, country: from contact info, if present.
- education: every real degree-granting program listed (skip bootcamps, certificates, single courses), most recent first, max 6. For schoolName, use ONLY the parent institution's name, normalized (e.g. "Harvard University", never "Harvard Kennedy School" or "Harvard Graduate School of Education" — strip the sub-school/department down to the university). degree/fieldOfStudy as listed; graduationDate as an ISO date (YYYY-01-01 if only a year is given), null if not stated.
- highestEducationLevel: the single highest degree completed, one of the provided categories (MBA is its own category, distinct from other MASTERS degrees).
- employers: every real job listed, max 12, in any order. companyName as the employer's name (not a client/project name); roleTitle as listed; startDate/endDate as ISO dates (YYYY-01-01 if only a year given), endDate null if isCurrent; companyIndustry as a few words describing that employer's industry.
- graduationDate: the graduation date of their most recent/highest degree, as an ISO date (YYYY-MM-DD). If only a year is given, use YYYY-01-01.
- firstJobStartDate: the start date of their EARLIEST listed job (their first job after school), as an ISO date. If only a year is given, use YYYY-01-01.
- latestJobTitle: their most recent job title.
- industry: the industry of their most recent employer, in a few words.
- primaryFunction: their primary functional area, constrained to one of the provided categories.
- aiReadinessScore (0-100) and aiReadinessNotes: assess how "AI-ready" this resume signals the candidate is — mentions of AI tools, automation, LLM usage, building with AI, etc. This is being captured for future use, not for immediate scoring — be honest and specific in the notes.
- resumeKeywords: up to 15 concrete skills, tools, technologies, certifications, and role-specific terms pulled directly from the resume text (e.g. "Salesforce", "P&L management", "Six Sigma", "Python") — used to match this candidate against job postings. Prefer specific, searchable terms over generic ones (skip words like "communication" or "teamwork").

Resume text:
`

// Distinct from highestEducationLevel (which only ever holds one value) —
// a candidate can hold multiple professional credentials at once (e.g. a
// JD/MBA dual degree), so each is its own independent flag rather than
// competing for the single "highest" slot. hasJD/hasMD in particular feed
// job-fit gating (see job-fit-bucket.ts) — a law-firm "Partner"/attorney
// posting should never surface to a candidate without hasJD, while that
// same firm's non-lawyer roles stay open to everyone.
function inferCredentials(
  education: { degree: string | null }[]
): { hasMBA: boolean; hasJD: boolean; hasMD: boolean; hasDO: boolean } {
  const degrees = education.map((entry) => entry.degree).filter((d): d is string => !!d)
  return {
    hasMBA: degrees.some((d) => /\bmba\b/i.test(d)),
    hasJD: degrees.some((d) => /\bj\.?d\.?\b/i.test(d) || /\bjuris doctor/i.test(d)),
    hasMD: degrees.some((d) => /\bm\.?d\.?\b/i.test(d) || /\bdoctor of medicine/i.test(d)),
    hasDO: degrees.some((d) => /\bd\.?o\.?\b/i.test(d) || /\bosteopathic/i.test(d)),
  }
}

export async function extractProfileFieldsFromResume(resumeId: string): Promise<void> {
  const resume = await prisma.resume.findUniqueOrThrow({ where: { id: resumeId } })

  if (!resume.extractedText) return

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5000, // bumped from 3000 — the new education[]/employers[] arrays materially grow output
      thinking: { type: 'disabled' },
      // No `effort` here — unlike Sonnet/Opus, Haiku 4.5 rejects the effort
      // parameter on structured outputs with a 400, which the bare catch
      // below was silently swallowing on every single call.
      output_config: { format: zodOutputFormat(profileFieldsSchema) },
      messages: [{ role: 'user', content: PROMPT_PREFIX + resume.extractedText }],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output

    if (!data) return

    const graduationDate = data.graduationDate ? new Date(data.graduationDate) : null
    const firstJobStartDate = data.firstJobStartDate ? new Date(data.firstJobStartDate) : null
    const yearsExperience = computeYearsExperienceFromResume(graduationDate, firstJobStartDate)
    const credentials = inferCredentials(data.education)

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
        metroArea: normalizeMetroArea(data.city),
        graduationDate,
        resumeFirstJobStartDate: firstJobStartDate,
        resumeLatestJobTitle: data.latestJobTitle,
        industryContext: data.industry,
        industryBucket: normalizeIndustryBucket(data.industry),
        primaryFunction: data.primaryFunction,
        yearsExperience,
        highestEducationLevel: data.highestEducationLevel,
        // Each credential flag only ever flips true, never overwrites a
        // previously-detected true with false (a later resume version that
        // omits the JD line shouldn't un-flag a real lawyer).
        hasMBA: credentials.hasMBA || undefined,
        hasJD: credentials.hasJD || undefined,
        hasMD: credentials.hasMD || undefined,
        hasDO: credentials.hasDO || undefined,
        resumeAiReadinessScore: data.aiReadinessScore,
        resumeAiReadinessNotes: data.aiReadinessNotes,
        resumeKeywords: data.resumeKeywords,
      },
    })

    const [{ insertedCount: educationInserted }, { insertedCount: employersInserted }] = await Promise.all([
      syncResumeEducation(
        resume.candidateId,
        data.education.map((entry) => ({
          schoolName: entry.schoolName,
          degree: entry.degree,
          fieldOfStudy: entry.fieldOfStudy,
          graduationDate: entry.graduationDate ? new Date(entry.graduationDate) : null,
        }))
      ).catch((error) => {
        console.error('Failed to sync resume-derived education:', error)
        return { insertedCount: 0 }
      }),
      syncResumeWorkHistory(
        resume.candidateId,
        data.employers.map((entry) => ({
          companyName: entry.companyName,
          roleTitle: entry.roleTitle,
          startDate: entry.startDate ? new Date(entry.startDate) : null,
          endDate: entry.endDate ? new Date(entry.endDate) : null,
          isCurrent: entry.isCurrent,
          companyIndustry: entry.companyIndustry,
        }))
      ).catch((error) => {
        console.error('Failed to sync resume-derived work history:', error)
        return { insertedCount: 0 }
      }),
    ])

    captureServerEvent(resume.candidateId, 'resume_education_extracted', {
      count: data.education.length,
      insertedCount: educationInserted,
    })
    captureServerEvent(resume.candidateId, 'resume_employers_extracted', {
      count: data.employers.length,
      insertedCount: employersInserted,
      dedupedCount: data.employers.length - employersInserted,
    })

    if (educationInserted > 0 || employersInserted > 0) {
      await computeStructuralFlags(resume.candidateId).catch((error) => {
        console.error('Failed to compute structural flags after resume upload:', error)
      })
    }
  } catch (error) {
    console.error('Failed to auto-fill profile fields from resume:', error)
    // Best-effort auto-fill — failure here must never block the resume
    // upload or its ATS/results/experience analysis.
  }
}
