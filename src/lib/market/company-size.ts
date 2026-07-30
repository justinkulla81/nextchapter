import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { CompanySizeBand } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { COMPANY_SIZE_TIERS } from '@/lib/market/company-size-tiers'

export interface ResolvedCompanySize {
  band: CompanySizeBand | null
  source: 'static' | 'llm' | 'unknown'
}

const SIZE_BAND_VALUES: CompanySizeBand[] = [
  'MICRO',
  'SMALL',
  'SMALL_MID',
  'MID',
  'MID_LARGE',
  'LARGE',
  'ENTERPRISE',
  'MEGA',
]

const companySizeSchema = z.object({
  // false if this isn't a real/identifiable company name at all — never
  // guess a band for something unrecognizable.
  recognized: z.boolean(),
  sizeBand: z.enum(SIZE_BAND_VALUES as [CompanySizeBand, ...CompanySizeBand[]]).nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

async function classifyCompanySizeViaLLM(
  companyName: string
): Promise<{ sizeBand: CompanySizeBand; confidence: number; reasoning: string } | null> {
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(companySizeSchema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `Estimate the current approximate employee headcount band for this company: "${companyName}".

Bands: MICRO (1-10), SMALL (11-50), SMALL_MID (51-200), MID (201-1000), MID_LARGE (1001-5000), LARGE (5001-20000), ENTERPRISE (20001-100000), MEGA (100000+).

If "${companyName}" isn't a real, identifiable company (e.g. it's a placeholder, a typo, or too vague to identify), set recognized to false and sizeBand to null. Otherwise give your best real-world estimate, even if approximate.`,
        },
      ],
    })
    const message = await stream.finalMessage()
    const data = message.parsed_output
    if (!data || !data.recognized || !data.sizeBand) return null
    return { sizeBand: data.sizeBand, confidence: data.confidence, reasoning: data.reasoning }
  } catch (error) {
    console.error('Failed to classify company size for', companyName, error)
    return null
  }
}

// Resolves a company name to an approximate employee-count band: static
// curated list first (free, no DB/LLM), then the permanent shared cache,
// then one Claude call whose result is cached forever so it's never
// re-queried for this company name again — see CompanySizeLookup in
// prisma/schema.prisma for why this makes the LLM cost one-time-per-
// distinct-company-name-ever-seen-platform-wide, never per-candidate and
// never recurring. Any failure (LLM error, unrecognized company) returns
// { band: null }, non-fatal — callers treat null as "no adjustment," never
// as a penalty or a block.
export async function resolveCompanySizeBand(companyName: string): Promise<ResolvedCompanySize> {
  const normalized = normalizeOrgName(companyName)
  if (!normalized) return { band: null, source: 'unknown' }

  const staticMatch = COMPANY_SIZE_TIERS.find((tier) => normalizeOrgName(tier.name) === normalized)
  if (staticMatch) return { band: staticMatch.sizeBand, source: 'static' }

  const cached = await prisma.companySizeLookup.findUnique({ where: { companyNameNormalized: normalized } })
  if (cached) return { band: cached.sizeBand, source: cached.source as 'static' | 'llm' }

  const classified = await classifyCompanySizeViaLLM(companyName)
  if (!classified) return { band: null, source: 'unknown' }

  const saved = await prisma.companySizeLookup.upsert({
    where: { companyNameNormalized: normalized },
    create: {
      companyNameNormalized: normalized,
      companyNameOriginal: companyName,
      sizeBand: classified.sizeBand,
      source: 'llm',
      confidence: classified.confidence,
      llmRawNotes: classified.reasoning,
    },
    update: {},
  })
  return { band: saved.sizeBand, source: 'llm' }
}
