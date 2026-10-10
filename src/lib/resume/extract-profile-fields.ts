import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { computeYearsExperienceFromResume } from '@/lib/resume/work-history-facts'
import { syncResumeEducation } from '@/lib/resume/sync-resume-education'
import { syncResumeWorkHistory } from '@/lib/resume/sync-resume-work-history'
import { computeStructuralFlags } from '@/lib/resume/compute-structural-flags'
import { recomputeCandidateLevelRank } from '@/lib/scoring/level-rank-service'
import { normalizeIndustryBucket } from '@/lib/constants/industry-buckets'
import { normalizeMetroArea } from '@/lib/constants/metro-areas'
import { captureServerEvent } from '@/lib/posthog/server'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'

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
    .max(30), // sanity ceiling only; the prompt asks for 10
  // A plain string, normalised to the allowed list in code (coerceOption). A strict enum
  // here threw away a member's WHOLE resume — every school and job — over one value that
  // fell outside the list.
  highestEducationLevel: z.string().nullable(),
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
    .max(60), // sanity ceiling only; the prompt asks for 20
  graduationDate: z.string().nullable(), // ISO date string, e.g. "2018-05-15"
  firstJobStartDate: z.string().nullable(), // ISO date string
  latestJobTitle: z.string().nullable(),
  industry: z.string().nullable(),
  primaryFunction: z.string().nullable(), // normalised in code, as above
  aiReadinessScore: z.number().nullable(), // clamped and rounded in code, not rejected
  aiReadinessNotes: z.string().nullable(),
  resumeKeywords: z.array(z.string()).max(80), // trimmed to 15 in code
  // Non-nullable array, like resumeKeywords/education/employers above — does
  // NOT count against the nullable/union-type cap that forced
  // secondaryFunctionIndustrySchema into its own call below.
  certifications: z.array(z.string()).max(50), // trimmed to 10 in code
})

// Kept as its own call rather than folded into profileFieldsSchema above —
// that schema already sits right at Anthropic's structured-output cap on
// nullable/union-typed parameters (16), confirmed by a real 400
// ("too many parameters with union types") the first time these two fields
// were added there. A second small Haiku call costs little and keeps the
// main extraction schema untouched.
const secondaryFunctionIndustrySchema = z.object({
  secondaryFunction: z.string().nullable(), // normalised in code, as above
  secondaryIndustry: z.string().nullable(),
})

const SECONDARY_PROMPT = `Look at this resume. If the candidate's most recent 1-2 roles are in a clearly different function or industry than the bulk of their career (e.g. a recent pivot), name that difference as secondaryFunction/secondaryIndustry. If their history is consistent, return null for both — do not force a secondary value when there isn't a real one.

Resume text:
`

const PROMPT_PREFIX = `Extract the following fields from this resume. Only extract what is explicitly present in the text — never fabricate or guess a value that isn't there; use null instead.

- firstName, lastName: from the resume header/contact info.
- email, phone, streetAddress, city, state, country: from contact info, if present.
- education: every real degree-granting program listed (skip bootcamps, certificates, single courses), most recent first, max 10. For schoolName, use ONLY the parent institution's name, normalized (e.g. "Harvard University", never "Harvard Kennedy School" or "Harvard Graduate School of Education" — strip the sub-school/department down to the university). degree/fieldOfStudy as listed; graduationDate as an ISO date (YYYY-01-01 if only a year is given), null if not stated.
- highestEducationLevel: the single highest degree completed, exactly one of: ${HIGHEST_EDUCATION_LEVELS.join(', ')} (MBA is its own category, distinct from other MASTERS degrees).
- employers: every real job listed (include a job even when its dates are missing — leave the date null, never guess one), max 20, in any order. companyName as the employer's name (not a client/project name); roleTitle as listed; startDate/endDate as ISO dates (YYYY-01-01 if only a year given), endDate null if isCurrent; companyIndustry as a few words describing that employer's industry.
- graduationDate: the graduation date of their most recent/highest degree, as an ISO date (YYYY-MM-DD). If only a year is given, use YYYY-01-01.
- firstJobStartDate: the start date of their EARLIEST listed job (their first job after school), as an ISO date. If only a year is given, use YYYY-01-01.
- latestJobTitle: their most recent job title.
- industry: the industry of their most recent employer, in a few words.
- primaryFunction: their primary functional area (the one that describes the bulk of their career), exactly one of: ${PRIMARY_FUNCTION_OPTIONS.join(', ')}.
- aiReadinessScore (0-100) and aiReadinessNotes: assess how "AI-ready" this resume signals the candidate is — mentions of AI tools, automation, LLM usage, building with AI, etc. This is being captured for future use, not for immediate scoring — be honest and specific in the notes.
- resumeKeywords: up to 15 concrete skills, tools, technologies, certifications, and role-specific terms pulled directly from the resume text (e.g. "Salesforce", "P&L management", "Six Sigma", "Python") — used to match this candidate against job postings. Prefer specific, searchable terms over generic ones (skip words like "communication" or "teamwork").
- certifications: up to 10 real professional certifications/credentials explicitly listed (e.g. "PMP", "CFA", "Six Sigma Black Belt", "SHRM-CP", "AWS Certified Solutions Architect", "CPA"). Only named, earned credentials — not degrees (those go in education) and not generic skills or tools. Empty array if none are listed.

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

// Best-effort default for confirm/page.tsx's "highest level you've reached"
// Select — otherwise every candidate lands on a blank dropdown despite the
// resume already saying enough to guess. Title-only (no scope/years data
// available at this point in the pipeline, unlike detectSeniorityBand),
// so it's a starting point the candidate can correct, not an authoritative
// read.
const C_SUITE_TITLE_PATTERN = /\b(chief|ceo|coo|cfo|cto|cmo|chro|cio|president|founder)\b/i
const VP_TITLE_PATTERN = /\b(vp|vice president|evp|svp|executive vice president|senior vice president)\b/i
const DIRECTOR_TITLE_PATTERN = /\b(director|head of)\b/i
const MANAGER_TITLE_PATTERN = /\b(manager|lead|principal|supervisor)\b/i

function inferHighestLevelFromTitle(latestJobTitle: string | null): (typeof HIGHEST_LEVEL_OPTIONS)[number] | null {
  if (!latestJobTitle) return null
  if (C_SUITE_TITLE_PATTERN.test(latestJobTitle)) return 'C-Suite'
  if (VP_TITLE_PATTERN.test(latestJobTitle)) return 'VP'
  if (DIRECTOR_TITLE_PATTERN.test(latestJobTitle)) return 'Director'
  if (MANAGER_TITLE_PATTERN.test(latestJobTitle)) return 'Manager'
  return 'IC'
}

// Map whatever the model wrote onto the allowed list (case, spacing and underscores
// ignored), or null. Never throws: an unrecognised value costs that one field, not the
// resume.
export function coerceOption<T extends string>(value: string | null | undefined, options: readonly T[]): T | null {
  if (!value) return null
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = norm(value)
  return options.find((o) => norm(o) === target) ?? null
}

export async function extractProfileFieldsFromResume(
  resumeId: string,
  // entriesOnly: sync the education and job entries and nothing else. Used to re-read
  // existing resumes (after the caps were raised) without touching a profile the member
  // may have corrected by hand — the full run rewrites city, name, phone and so on.
  opts: { entriesOnly?: boolean } = {}
): Promise<void> {
  const resume = await prisma.resume.findUniqueOrThrow({ where: { id: resumeId } })

  if (!resume.extractedText) {
    // Silent before: an image-only PDF or a failed text extraction simply did nothing.
    captureServerEvent(resume.candidateId, 'resume_extraction_skipped', { resumeId, reason: 'no_extracted_text' })
    return
  }

  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000, // the education[]/employers[] arrays are large; a truncated JSON reply fails the whole parse
      thinking: { type: 'disabled' },
      // No `effort` here — unlike Sonnet/Opus, Haiku 4.5 rejects the effort
      // parameter on structured outputs with a 400, which the bare catch
      // below was silently swallowing on every single call.
      output_config: { format: zodOutputFormat(profileFieldsSchema) },
      messages: [{ role: 'user', content: PROMPT_PREFIX + resume.extractedText }],
    })
    const secondaryStream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(secondaryFunctionIndustrySchema) },
      messages: [{ role: 'user', content: SECONDARY_PROMPT + resume.extractedText }],
    })

    const [message, secondaryMessage] = await Promise.all([stream.finalMessage(), secondaryStream.finalMessage()])
    const data = message.parsed_output
    const secondaryData = secondaryMessage.parsed_output

    if (!data) {
      captureServerEvent(resume.candidateId, 'resume_extraction_failed', { resumeId, reason: 'no_parsed_output' })
      return
    }

    const graduationDate = data.graduationDate ? new Date(data.graduationDate) : null
    const firstJobStartDate = data.firstJobStartDate ? new Date(data.firstJobStartDate) : null
    const yearsExperience = computeYearsExperienceFromResume(graduationDate, firstJobStartDate)
    const credentials = inferCredentials(data.education)

    // Merged, not overwritten — same additive reasoning as the hasMBA/hasJD/
    // hasMD/hasDO flags above: a later resume that's less detailed about
    // credentials shouldn't erase one already confirmed.
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { id: resume.candidateId },
      select: { certifications: true, highestLevelReached: true, firstName: true, lastName: true },
    })
    const mergedCertifications = Array.from(new Set([...(existingProfile?.certifications ?? []), ...data.certifications.slice(0, 10)]))
    // Never overwrite a level the candidate already confirmed by hand on
    // confirm/page.tsx — only fill it in while it's still blank.
    const highestLevelReached = existingProfile?.highestLevelReached ?? inferHighestLevelFromTitle(data.latestJobTitle)

    // Real, confirmed production bug: this used to write data.firstName/
    // lastName unconditionally, straight from the resume's own extraction —
    // no plausibility check, and no protection against a later resume
    // upload blanking out a name a previous one had correctly found. A
    // candidate whose resume still had an unfilled AI-drafting-tool
    // template header ("FIRST LAST") got exactly that literal text written
    // into their real profile. Now: never write an obvious placeholder
    // name at all, and never let a null/placeholder extraction from a
    // later resume erase a real name a previous one already set — same
    // "fill in while blank, never regress" posture already used for
    // highestLevelReached above.
    const extractedFirstName = isPlaceholderName(`${data.firstName ?? ''} ${data.lastName ?? ''}`) ? null : data.firstName
    const extractedLastName = isPlaceholderName(`${data.firstName ?? ''} ${data.lastName ?? ''}`) ? null : data.lastName
    const firstName = extractedFirstName ?? existingProfile?.firstName ?? null
    const lastName = extractedLastName ?? existingProfile?.lastName ?? null

    if (!opts.entriesOnly) await prisma.candidateProfile.update({
      where: { id: resume.candidateId },
      data: {
        firstName,
        lastName,
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
        highestLevelReached,
        industryContext: data.industry,
        industryBucket: normalizeIndustryBucket(data.industry),
        primaryFunction: coerceOption(data.primaryFunction, PRIMARY_FUNCTION_OPTIONS),
        secondaryFunction: coerceOption(secondaryData?.secondaryFunction ?? null, PRIMARY_FUNCTION_OPTIONS),
        secondaryIndustryContext: secondaryData?.secondaryIndustry ?? null,
        yearsExperience,
        highestEducationLevel: coerceOption(data.highestEducationLevel, HIGHEST_EDUCATION_LEVELS),
        // Each credential flag only ever flips true, never overwrites a
        // previously-detected true with false (a later resume version that
        // omits the JD line shouldn't un-flag a real lawyer).
        hasMBA: credentials.hasMBA || undefined,
        hasJD: credentials.hasJD || undefined,
        hasMD: credentials.hasMD || undefined,
        hasDO: credentials.hasDO || undefined,
        resumeAiReadinessScore:
          data.aiReadinessScore === null ? null : Math.max(0, Math.min(100, Math.round(data.aiReadinessScore))),
        resumeAiReadinessNotes: data.aiReadinessNotes,
        resumeKeywords: data.resumeKeywords.slice(0, 15),
        certifications: mergedCertifications,
      },
    })

    const [{ insertedCount: educationInserted }, { insertedCount: employersInserted, undatedCount }] = await Promise.all([
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
        })),
        { resumeId: resume.id }
      ).catch((error) => {
        console.error('Failed to sync resume-derived work history:', error)
        return { insertedCount: 0, undatedCount: 0 }
      }),
    ])

    captureServerEvent(resume.candidateId, 'resume_education_extracted', {
      count: data.education.length,
      insertedCount: educationInserted,
    })
    captureServerEvent(resume.candidateId, 'resume_employers_extracted', {
      count: data.employers.length,
      insertedCount: employersInserted,
      // Kept (in UndatedEmployment) rather than dropped; counted so we can see how often.
      undatedCount,
      dedupedCount: data.employers.length - employersInserted - undatedCount,
    })

    if (educationInserted > 0 || employersInserted > 0) {
      await computeStructuralFlags(resume.candidateId).catch((error) => {
        console.error('Failed to compute structural flags after resume upload:', error)
      })
    }

    if (employersInserted > 0) {
      await recomputeCandidateLevelRank(resume.candidateId).catch((error) => {
        console.error('Failed to recompute level rank after resume upload:', error)
      })
    }
  } catch (error) {
    console.error('Failed to auto-fill profile fields from resume:', error)
    captureServerEvent(resume.candidateId, 'resume_extraction_failed', {
      resumeId,
      reason: 'error',
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    })
    // Best-effort auto-fill — failure here must never block the resume
    // upload or its ATS/results/experience analysis.
  }
}
