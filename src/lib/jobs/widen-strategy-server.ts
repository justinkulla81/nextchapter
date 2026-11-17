import 'server-only'
import { prisma } from '@/lib/prisma'
import { stateName } from '@/lib/pivots/scoring'
import { stateCode } from '@/lib/pivots/load'
import { loadAddressableMarket } from '@/lib/profile/addressable-market'
import { readSearchExpansion, STATE_NEIGHBORS } from '@/lib/profile/search-expansion'
import { industriesHiringTarget, memberMarketTarget, type MarketMember } from '@/lib/market/market-size-server'
import { subFunctionLabel } from '@/lib/jobs/sub-functions'
import { topCities, type CityStatRow } from '@/lib/market/city-stats'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { functionKeyFor, industryKeyFor, readWidenStrategy, skillsIntel, type WidenCity, type WidenStrategyView } from './widen-strategy'

// The server half of the Widen your search page (widen-strategy.ts). Reads, per page view:
//  - MarketCityStat for the member's function and their first industry: at most 60 cities x 9 bands for the function, 15 x 9 for function-in-industry
//    (up to ~540 narrow rows for a function, ~45 KB), held per instance for 30 minutes per key.
//  - The addressable market (related roles, remote count) and the market-size rows for their function, both
//    already cached for the market pages.
//  - The skills-market snapshot, held per instance for 30 minutes (market-server.ts).
// No board scan.

const TTL_MS = 30 * 60_000
const held = new Map<string, { at: number; rows: Promise<CityStatRow[]> }>()

function cityRows(kind: 'fn' | 'fn_ind', key: string): Promise<CityStatRow[]> {
  const k = `${kind}|${key}`
  const hit = held.get(k)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows
  const rows = prisma.marketCityStat
    .findMany({ where: { kind, key }, select: { kind: true, key: true, band: true, city: true, state: true, openNow: true } })
    .then((r) => r as CityStatRow[])
    .catch((error) => {
      console.error('Market city stats unavailable:', error)
      held.delete(k)
      return [] as CityStatRow[]
    })
  held.set(k, { at: Date.now(), rows })
  return rows
}

type WidenMember = MarketMember & {
  id: string
  journeyDetails: unknown
  searchExpansion: unknown
  resumeKeywords: string[]
  confirmedSkillsHave: string[]
}

export async function loadWidenStrategy(p: WidenMember): Promise<WidenStrategyView> {
  const target = memberMarketTarget(p)
  const home = stateCode(p.currentState ?? null)
  const exp = readSearchExpansion(p.searchExpansion)
  const firstIndustry = target?.industries?.[0] ?? null
  const [fnRows, indRows, market, industries, skillsMarket] = await Promise.all([
    target ? cityRows('fn', target.fn) : Promise.resolve([]),
    target && firstIndustry ? cityRows('fn_ind', `${target.fn}|${firstIndustry}`) : Promise.resolve([]),
    loadAddressableMarket(p.id).catch(() => null),
    target ? industriesHiringTarget(p).catch(() => []) : Promise.resolve([]),
    loadSkillsMarket(),
  ])
  const bands = target?.stages ?? []
  const asCities = (rows: CityStatRow[]): WidenCity[] => {
    // A member at a level with too few jobs per city still sees where the work is: all levels.
    const mine = topCities(rows, bands)
    const list = mine.length >= 3 ? mine : topCities(rows, [])
    return list.map((c) => ({ ...c, stateName: stateName(c.state), home: c.state === home }))
  }
  const fnLabel = target ? (subFunctionLabel(target.subFunction) ?? target.fn) : null
  const terms = [...p.resumeKeywords, ...p.confirmedSkillsHave]
  const roles = (market?.expansions ?? []).flatMap((e) => (e.kind === 'role' ? [{ role: e.role, label: e.label, openNow: e.open, carry: e.carry, toAdd: e.toAdd }] : []))
  const remoteOpen = market?.expansions.find((e) => e.kind === 'remote')?.open ?? market?.remote ?? 0
  const topIndustry = industries[0]?.industry ?? null
  const topIndustryKey = topIndustry ? industryKeyFor(skillsMarket, topIndustry) : null
  return {
    fnLabel,
    homeState: home,
    citiesForFunction: asCities(fnRows),
    citiesForIndustry: firstIndustry && indRows.length > 0 ? { industry: firstIndustry, cities: asCities(indRows) } : null,
    remoteOpen,
    industries,
    roles,
    skills: target ? skillsIntel(skillsMarket, terms, { dim: 'function', key: functionKeyFor(target.fn) }, target.fn.toLowerCase()) : null,
    industrySkills: topIndustry && topIndustryKey ? skillsIntel(skillsMarket, terms, { dim: 'industry', key: topIndustryKey }, topIndustry) : null,
    on: { remote: exp.remote, states: exp.states, cities: (exp.cities ?? []).map((c) => c.name), industries: exp.industries, roles: exp.roles },
    savedAt: readWidenStrategy(p.journeyDetails)?.at ?? null,
  }
}

/**
 * The top cities in the member's neighbouring states for their kind of work at their level: the market page's
 * "just across the state line" suggestions, offered one city at a time instead of whole states. Same cached
 * MarketCityStat rows as the Widen your search page.
 */
export async function loadNearbyCities(p: MarketMember, limit = 4): Promise<WidenCity[]> {
  const target = memberMarketTarget(p)
  const home = stateCode(p.currentState ?? null)
  if (!target || !home) return []
  const neighbours = STATE_NEIGHBORS[home] ?? []
  if (neighbours.length === 0) return []
  const rows = (await cityRows('fn', target.fn)).filter((r) => neighbours.includes(r.state))
  const mine = topCities(rows, target.stages, limit)
  const list = mine.length > 0 ? mine : topCities(rows, [], limit)
  return list.filter((c) => c.openNow >= 3).map((c) => ({ ...c, stateName: stateName(c.state), home: false }))
}
