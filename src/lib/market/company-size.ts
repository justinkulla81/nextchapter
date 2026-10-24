import 'server-only'
import { after } from 'next/server'
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

async function classifyAndCacheCompanySize(companyName: string, normalized: string): Promise<void> {
  const classified = await classifyCompanySizeViaLLM(companyName)
  if (!classified) return
  await prisma.companySizeLookup.upsert({
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
}

// Resolves a company name to an approximate employee-count band: static
// curated list first (free, no DB/LLM), then the permanent shared cache.
// On a genuine cache miss (this company name has never been seen platform-
// wide), the LLM classification is deferred to after() rather than awaited
// — every candidate landing on a brand-new company name used to pay for a
// live, synchronous Claude call before their page could render at all. This
// returns { band: null } for that one render (never a penalty — callers
// already treat null as "no adjustment") and the after() call populates the
// permanent cache, so the very next time anyone sees this company name
// (including a re-render/reload of this same page) it resolves instantly.
export async function resolveCompanySizeBand(companyName: string): Promise<ResolvedCompanySize> {
  const normalized = normalizeOrgName(companyName)
  if (!normalized) return { band: null, source: 'unknown' }

  const staticMatch = COMPANY_SIZE_TIERS.find((tier) => normalizeOrgName(tier.name) === normalized)
  if (staticMatch) return { band: staticMatch.sizeBand, source: 'static' }

  const cached = await prisma.companySizeLookup.findUnique({ where: { companyNameNormalized: normalized } })
  if (cached) return { band: cached.sizeBand, source: cached.source as 'static' | 'llm' }

  after(() => classifyAndCacheCompanySize(companyName, normalized))
  return { band: null, source: 'unknown' }
}

// Batched form of resolveCompanySizeBand for a page that resolves a whole list
// of names: identical per-name semantics (static table first, then the
// permanent cache, else null now and a background classify), but one
// findMany for every name that is not in the static table instead of one
// findUnique per name. Results are index-aligned with `companyNames`.
export async function resolveCompanySizeBands(companyNames: string[]): Promise<ResolvedCompanySize[]> {
  const normalized = companyNames.map((n) => normalizeOrgName(n))
  const results: (ResolvedCompanySize | null)[] = normalized.map((norm) => {
    if (!norm) return { band: null, source: 'unknown' as const }
    const staticMatch = COMPANY_SIZE_TIERS.find((tier) => normalizeOrgName(tier.name) === norm)
    return staticMatch ? { band: staticMatch.sizeBand, source: 'static' as const } : null
  })

  const lookupKeys = [...new Set(normalized.filter((norm, i) => results[i] === null && norm))]
  const cachedRows =
    lookupKeys.length > 0
      ? await prisma.companySizeLookup.findMany({ where: { companyNameNormalized: { in: lookupKeys } } })
      : []
  const cachedByKey = new Map(cachedRows.map((r) => [r.companyNameNormalized, r]))

  const scheduled = new Set<string>()
  return results.map((resolved, i) => {
    if (resolved) return resolved
    const norm = normalized[i]
    const cached = cachedByKey.get(norm)
    if (cached) return { band: cached.sizeBand, source: cached.source as 'static' | 'llm' }
    if (!scheduled.has(norm)) {
      scheduled.add(norm)
      const name = companyNames[i]
      after(() => classifyAndCacheCompanySize(name, norm))
    }
    return { band: null, source: 'unknown' as const }
  })
}

// Every employer size band known without an LLM call, by normalized name: the curated
// static list, the permanent CompanySizeLookup cache and Company.sizeBand (the cache
// wins over Company, the static list over both). For the board's level flex
// (level-flex.ts); held for 30 minutes.
const SIZE_MAP_TTL_MS = 30 * 60_000
const globalForSizes = globalThis as unknown as { boardCompanySizes?: { at: number; map: Promise<Map<string, CompanySizeBand>> } }

export function loadBoardCompanySizes(now = Date.now()): Promise<Map<string, CompanySizeBand>> {
  const held = globalForSizes.boardCompanySizes
  if (held && now - held.at < SIZE_MAP_TTL_MS) return held.map
  const map = (async () => {
    const out = new Map<string, CompanySizeBand>()
    const [companies, cached] = await Promise.all([
      prisma.company.findMany({ where: { sizeBand: { not: null } }, select: { canonicalNameNormalized: true, sizeBand: true } }),
      prisma.companySizeLookup.findMany({ select: { companyNameNormalized: true, sizeBand: true } }),
    ])
    for (const c of companies) if (c.sizeBand) out.set(c.canonicalNameNormalized, c.sizeBand)
    for (const c of cached) out.set(c.companyNameNormalized, c.sizeBand)
    for (const t of COMPANY_SIZE_TIERS) {
      const norm = normalizeOrgName(t.name)
      if (norm) out.set(norm, t.sizeBand)
    }
    return out
  })()
  globalForSizes.boardCompanySizes = { at: now, map }
  map.catch(() => {
    if (globalForSizes.boardCompanySizes?.map === map) globalForSizes.boardCompanySizes = undefined
  })
  return map
}
