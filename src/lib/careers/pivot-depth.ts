import 'server-only'
import { getTaxonomy } from '@/lib/careers/taxonomy'
import { occupationForRoleText, resolveCandidateOccupation, type OccupationResolution, type OccupationSource } from '@/lib/careers/candidate-occupation'
import { describePivot, nationalPayFromProfile, rankPivots, type PivotOption, type RankPivotsInput, type WageFloor } from '@/lib/careers/pivots'
import { resolveArea } from '@/lib/careers/area'
import { skillIdsFromKeywords } from '@/lib/careers/alias-server'
import { getAreaCatalog, getPayLookup } from '@/lib/careers/local-pay-server'
import { bestPay } from '@/lib/careers/local-pay'
import { toStateCode } from '@/lib/careers/state'
import type { PayByLevel, PayInfo } from '@/lib/careers/local-pay'

/**
 * The O*NET and BLS side of Pivot paths: what a role asks for, what it pays where the person
 * lives, and what training closes the gap. It is a layer on the market-ranked list, so every
 * failure here (data not loaded, no title to start from) leaves that list working on its own.
 */

export interface PivotDepthProfile {
  id: string
  currentCity: string | null
  currentState: string | null
  resumeKeywords: string[]
  confirmedSkillsHave: string[]
}

export interface PivotDepth {
  sourceSoc: string
  sourceTitle: string
  source: OccupationSource
  sourcePay: PayInfo | null
  localLabel: string | null
  stateCode: string | null
  input: RankPivotsInput
}

export type PivotDepthResult = { status: 'ready'; depth: PivotDepth } | { status: 'needs_choice' | 'no_title' | 'unavailable'; resolution: OccupationResolution }

export async function loadPivotDepth(profile: PivotDepthProfile, wageFloor: WageFloor, resolution?: OccupationResolution): Promise<PivotDepthResult> {
  const resolved = resolution ?? (await resolveCandidateOccupation(profile.id))
  if (resolved.status !== 'resolved') return { status: resolved.status, resolution: resolved }
  const taxonomy = await getTaxonomy()
  if (!taxonomy) return { status: 'unavailable', resolution: { status: 'unavailable' } }

  // Pay is compared place to place: their metro area if we hold it, else their state, else the nation.
  const area = resolveArea({ city: profile.currentCity, state: profile.currentState }, await getAreaCatalog())
  const lookup = await getPayLookup(area)
  const payOf = (soc: string): PayByLevel => {
    const local = lookup(soc)
    return Object.keys(local).length > 0 ? local : nationalPayFromProfile(taxonomy.profiles.get(soc))
  }
  const haveKeywords = [...profile.resumeKeywords, ...profile.confirmedSkillsHave]
  const input: RankPivotsInput = {
    space: taxonomy.space,
    profiles: taxonomy.profiles,
    sourceSoc: resolved.socCode,
    wageFloor,
    resumeKeywords: haveKeywords,
    haveSkillIds: await skillIdsFromKeywords(haveKeywords),
    pay: payOf,
  }
  return {
    status: 'ready',
    depth: {
      sourceSoc: resolved.socCode,
      sourceTitle: taxonomy.profiles.get(resolved.socCode)?.title ?? resolved.title,
      source: resolved.source,
      sourcePay: bestPay(payOf(resolved.socCode)),
      localLabel: area.metro?.name ?? area.state?.name ?? null,
      stateCode: toStateCode(profile.currentState),
      input,
    },
  }
}

/** The closest roles by skills, for the "more roles that use similar skills" list. */
export function similarRoles(depth: PivotDepth, exclude: ReadonlySet<string>): PivotOption[] {
  return rankPivots({ ...depth.input, limit: 12 + exclude.size }).filter((o) => !exclude.has(o.socCode)).slice(0, 12)
}

/** Each curated pivot role matched to an O*NET occupation by its name, then described against the current one. */
export async function optionsForLabels(depth: PivotDepth, labels: { key: string; label: string }[]): Promise<Map<string, PivotOption>> {
  const out = new Map<string, PivotOption>()
  const socs = await Promise.all(labels.map((l) => occupationForRoleText(l.label)))
  labels.forEach((l, i) => {
    const soc = socs[i]
    const option = soc ? describePivot(depth.input, soc) : null
    if (option) out.set(l.key, option)
  })
  return out
}
