import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'

export interface ResolvedCompanyIndustry {
  bucket: string | null
  source: 'llm' | 'unknown'
}

const industrySchema = z.object({
  // false if this isn't a real/identifiable company name at all — never
  // guess a bucket for something unrecognizable.
  recognized: z.boolean(),
  industryBucket: z.enum(INDUSTRY_BUCKET_NAMES as [string, ...string[]]).nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

async function classifyCompanyIndustryViaLLM(
  companyName: string
): Promise<{ industryBucket: string; confidence: number; reasoning: string } | null> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(industrySchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `Classify this company's primary industry: "${companyName}".

Choose exactly one from: ${INDUSTRY_BUCKET_NAMES.join(', ')}.

If "${companyName}" isn't a real, identifiable company (e.g. it's a placeholder, a typo, or too vague to identify), set recognized to false and industryBucket to null. Otherwise pick the closest matching bucket, even if approximate.`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output
    if (!data || !data.recognized || !data.industryBucket) return null
    return { industryBucket: data.industryBucket, confidence: data.confidence, reasoning: data.reasoning }
  } catch (error) {
    console.error('Failed to classify company industry for', companyName, error)
    return null
  }
}

// Resolves a company name to one of the app's normalized industry buckets
// (src/lib/constants/industry-buckets.ts): the permanent shared cache first,
// then one Claude call whose result is cached forever so it's never
// re-queried for this company name again platform-wide — see
// CompanyIndustryLookup in prisma/schema.prisma, mirroring the exact same
// pattern resolveCompanySizeBand (company-size.ts) already uses in
// production. Any failure (LLM error, unrecognized company) returns
// { bucket: null }, non-fatal — callers treat null as "no data," never as a
// penalty.
export async function resolveCompanyIndustry(companyName: string): Promise<ResolvedCompanyIndustry> {
  const normalized = normalizeOrgName(companyName)
  if (!normalized) return { bucket: null, source: 'unknown' }

  const cached = await prisma.companyIndustryLookup.findUnique({ where: { companyNameNormalized: normalized } })
  if (cached) return { bucket: cached.industryBucket, source: 'llm' }

  const classified = await classifyCompanyIndustryViaLLM(companyName)
  if (!classified) return { bucket: null, source: 'unknown' }

  const saved = await prisma.companyIndustryLookup.upsert({
    where: { companyNameNormalized: normalized },
    create: {
      companyNameNormalized: normalized,
      companyNameOriginal: companyName,
      industryBucket: classified.industryBucket,
      source: 'llm',
      confidence: classified.confidence,
      llmRawNotes: classified.reasoning,
    },
    update: {},
  })
  return { bucket: saved.industryBucket, source: 'llm' }
}
