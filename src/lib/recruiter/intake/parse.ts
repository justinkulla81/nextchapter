import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient } from '@/lib/anthropic'
import { prisma } from '@/lib/prisma'
import { HIGHEST_LEVEL_OPTIONS, PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import type { ParsedIntakeResume } from './prescan'

// One Haiku 4.5 call per intake resume (approved metered cost, 2026-10-05),
// capped per firm per day by reserveParseSlot below. The "is this a resume"
// check rides in the same call instead of a second classifier call.
// Stays under Anthropic's 16 nullable/union-field structured-output cap.
const intakeResumeSchema = z.object({
  isResume: z.boolean(),
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  location: z.string().nullable(),
  currentTitle: z.string().nullable(),
  currentEmployer: z.string().nullable(),
  previousEmployer: z.string().nullable(),
  level: z.enum(HIGHEST_LEVEL_OPTIONS).nullable(),
  primaryFunction: z.enum(PRIMARY_FUNCTION_OPTIONS).nullable(),
  industry: z.string().nullable(),
  yearsExperience: z.number().int().min(0).max(60).nullable(),
  keywords: z.array(z.string()).max(15),
  summary: z.array(z.string()).max(3),
})

export type IntakeResumeFields = z.infer<typeof intakeResumeSchema>

const PROMPT = `You are reading a resume that was sent to an executive search firm. Extract only what the text states; use null when a field is not there. Never guess.

- isResume: false only if this is clearly not a resume (a cover letter alone, a blank page, an unrelated document).
- fullName, email, phone, linkedinUrl, location (city and state or country, as written).
- currentTitle and currentEmployer: the most recent role. previousEmployer: the employer before that.
- level: the most recent role's level, one of the categories (IC, Manager, Director, VP, C-Suite).
- primaryFunction: the function that describes most of their career, one of the categories.
- industry: the most recent employer's industry, in a few words.
- yearsExperience: years since their first professional job, if dates allow.
- keywords: up to 15 concrete, searchable skills, domains and credentials from the text.
- summary: exactly 3 short factual lines a recruiter can scan (current role and scope; career arc; standout facts). No opinions, no praise, no judgement of fit.

Resume text:
`

export async function parseIntakeResumeText(text: string): Promise<IntakeResumeFields | null> {
  const client = getAnthropicClient()
  const message = await client.messages
    .stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      thinking: { type: 'disabled' },
      // No `effort`: Haiku 4.5 rejects it on structured outputs.
      output_config: { format: zodOutputFormat(intakeResumeSchema) },
      messages: [{ role: 'user', content: PROMPT + text.slice(0, 40_000) }],
    })
    .finalMessage()
  return message.parsed_output ?? null
}

export function toPrescanInput(fields: IntakeResumeFields): ParsedIntakeResume {
  return {
    currentTitle: fields.currentTitle,
    currentEmployer: fields.currentEmployer,
    level: fields.level,
    primaryFunction: fields.primaryFunction,
    industry: fields.industry,
    location: fields.location,
    keywords: fields.keywords,
  }
}

function utcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

// Atomically takes one of today's parse slots for the firm. false = the
// firm hit its daily cap; the resume stays QUEUED for tomorrow's cron.
export async function reserveParseSlot(firmId: string, cap: number): Promise<boolean> {
  const day = utcDay()
  await prisma.intakeParseUsage.upsert({
    where: { firmId_day: { firmId, day } },
    create: { firmId, day, count: 0 },
    update: {},
  })
  const taken = await prisma.intakeParseUsage.updateMany({
    where: { firmId, day, count: { lt: cap } },
    data: { count: { increment: 1 } },
  })
  return taken.count === 1
}
