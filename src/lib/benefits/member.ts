import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { parseRelocation } from '@/lib/journey/relocation'
import { listPrograms, seedCatalogIfEmpty } from './store'
import { cleanSelfTags, deriveWorkTags, groupByGoal, matchPrograms, type AudienceTag, type Goal, type Match, type MemberFacts } from './match'
import type { BenefitProgramRow } from './types'

type FundingProfile = Pick<
  CandidateProfile,
  'currentState' | 'journeyDetails' | 'openToRelocation' | 'currentJobStatus' | 'isPivoting' | 'primaryFunction' | 'industryContext' | 'industryBucket' | 'targetFunction'
>

const US_STATE = /^[A-Z]{2}$/

/** What the member said about themselves for matching, kept in journeyDetails.funding. */
export function savedFundingTags(details: unknown): AudienceTag[] {
  return cleanSelfTags((details as { funding?: { tags?: unknown } } | null)?.funding?.tags)
}

export function factsFor(p: FundingProfile): { facts: MemberFacts; selfTags: AudienceTag[]; relocationAnswered: boolean } {
  const details = p.journeyDetails as { relocation?: unknown } | null
  const relocation = parseRelocation(details, p.openToRelocation)
  const selfTags = savedFundingTags(p.journeyDetails)
  const state = p.currentState && US_STATE.test(p.currentState.trim().toUpperCase()) ? p.currentState.trim().toUpperCase() : null
  return {
    selfTags,
    relocationAnswered: !!details?.relocation || p.openToRelocation,
    facts: {
      state,
      relocation: { scope: relocation.scope, states: relocation.states ?? [] },
      laidOff: p.currentJobStatus === 'LAID_OFF',
      pivoting: p.isPivoting || p.currentJobStatus === 'CAREER_PIVOT',
      tags: [...new Set([...selfTags, ...deriveWorkTags(p)])],
    },
  }
}

/** Verified, open-or-unknown programs. Reads the table; if it is missing or empty, the catalog bundled with the app. */
export async function loadFundingPrograms(): Promise<BenefitProgramRow[]> {
  try {
    await seedCatalogIfEmpty()
    return await listPrograms({ verifiedOnly: true, limit: 2000 })
  } catch {
    const catalog = (await import('./catalog.json')).default as unknown as { rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }
    return catalog.rows.map((r) => ({ ...r, checkedAt: r.checkedAt ? new Date(r.checkedAt) : null }))
  }
}

export interface FundingResult {
  facts: MemberFacts
  selfTags: AudienceTag[]
  relocationAnswered: boolean
  matches: Match[]
  byGoal: Record<Goal, Match[]>
}

export async function fundingFor(p: FundingProfile): Promise<FundingResult> {
  const { facts, selfTags, relocationAnswered } = factsFor(p)
  const matches = matchPrograms(await loadFundingPrograms(), facts)
  return { facts, selfTags, relocationAnswered, matches, byGoal: groupByGoal(matches) }
}
