import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { parseRelocation } from '@/lib/journey/relocation'
import { listPrograms, seedCatalogIfEmpty } from './store'
<<<<<<< HEAD
import { cleanSelfTags, deriveWorkTags, groupByGoal, matchPrograms, tagsFromSelfId, type AudienceTag, type Goal, type Match, type MemberFacts } from './match'
=======
import { cleanSelfTags, deriveWorkTags, groupByGoal, matchPrograms, workKnown, type AudienceTag, type Goal, type Match, type MemberFacts } from './match'
>>>>>>> origin/main
import type { BenefitProgramRow } from './types'

type FundingProfile = Pick<
  CandidateProfile,
  'currentState' | 'currentCity' | 'journeyDetails' | 'eeocRaceEthnicity' | 'eeocGenderIdentity' | 'eeocVeteranStatus' | 'eeocDisabilityStatus' | 'openToRelocation' | 'currentJobStatus' | 'isPivoting' | 'primaryFunction' | 'industryContext' | 'industryBucket' | 'targetFunction'
>

const US_STATE = /^[A-Z]{2}$/

/** What the member said about themselves for matching, kept in journeyDetails.funding. */
export function savedFundingTags(details: unknown): AudienceTag[] {
  return cleanSelfTags((details as { funding?: { tags?: unknown } } | null)?.funding?.tags)
}

/** True only when the member chose to let their voluntary self-ID answers be used for funding matches. */
export function usesSelfId(details: unknown): boolean {
  return (details as { funding?: { useSelfId?: unknown } } | null)?.funding?.useSelfId === true
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
      city: p.currentCity,
      laidOff: p.currentJobStatus === 'LAID_OFF',
      pivoting: p.isPivoting || p.currentJobStatus === 'CAREER_PIVOT',
<<<<<<< HEAD
      tags: [...new Set([...selfTags, ...deriveWorkTags(p), ...(usesSelfId(p.journeyDetails) ? tagsFromSelfId({ race: p.eeocRaceEthnicity, gender: p.eeocGenderIdentity, veteran: p.eeocVeteranStatus, disability: p.eeocDisabilityStatus }) : [])])],
=======
      tags: [...new Set([...selfTags, ...deriveWorkTags(p)])],
      workKnown: workKnown(p),
      // Until they save the 'which are true for you' answers we do not know, so group-specific programs stay in.
      answered: !!(p.journeyDetails as { funding?: { savedAt?: string } } | null)?.funding?.savedAt,
>>>>>>> origin/main
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
