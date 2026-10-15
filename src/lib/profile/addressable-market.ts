import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'
import { ROLES, detectSourceRole, roleForTitle } from '@/lib/pivots/pivot-map'
import { BANDS, StatIndex, bestTrend, memberBand, stateName, wantsRemote, type MarketStatRow, type PivotSuggestion } from '@/lib/pivots/scoring'
import { loadPivotPaths, stateCode, PIVOT_PROFILE_SELECT } from '@/lib/pivots/load'
import { aiOutlookForRole, aiOutlookForFunction, type AiOutlook } from './ai-outlook'
import { readSearchExpansion, STATE_NEIGHBORS, type SearchExpansion } from './search-expansion'

// The addressable job market: how many jobs a person could realistically get
// given what they're searching for (role and level), where (their state, plus
// remote if they'd take it) and whether that market is growing, and how
// exposed the work is to AI. Then the ways to make it bigger, each opt-in:
// remote, neighboring states, a move, pivot roles that use their skills, and
// other industries hiring their kind of role.
//
// Reads precomputed market rows (PivotMarketStat, nightly) and, for
// industries, one cached group-by on the live board. Never scans the board
// per request.

export const NARROW_BELOW = 25 // open roles in their market
const GEO_SHARE_BELOW = 0.02 // their place holds under 2% of the national market

export type MarketFlag = { key: 'narrow' | 'geo' | 'shrinking' | 'ai'; title: string; detail: string }
export type Expansion =
  | { kind: 'remote'; open: number; label: string }
  | { kind: 'state'; state: string; open: number; label: string }
  | { kind: 'relocate'; open: number; label: string }
  | { kind: 'role'; role: string; label: string; open: number | null; fitLabel: string; carry: string[]; toAdd: string[]; ai: AiOutlook | null }
  | { kind: 'industry'; industry: string; open: number; label: string }

export type AddressableMarket = {
  role: { key: string; label: string } | null
  placeLabel: string | null
  local: number | null
  remote: number
  national: number
  trendPct: number | null
  ai: AiOutlook | null
  flags: MarketFlag[]
  expansions: Expansion[]
  optedIn: SearchExpansion
  marketReady: boolean
}

const industriesForRole = unstable_cache(
  async (roleKey: string, states: string[], remote: boolean) => {
    const role = ROLES.get(roleKey)
    if (!role) return []
    const words = [...new Set(role.examples.map((e) => e.toLowerCase()))].slice(0, 6)
    const rows = await prisma.exclusiveJobPosting.groupBy({
      by: ['industry'],
      where: liveBoardWhere({
        industry: { not: null },
        OR: words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })),
        ...(states.length || remote
          ? { AND: [{ OR: [...(states.length ? [{ locationState: { in: states } }] : []), ...(remote ? [{ workArrangement: 'remote' }] : [])] }] }
          : {}),
      }),
      _count: { _all: true },
      orderBy: { _count: { industry: 'desc' } },
      take: 12,
    })
    return rows.filter((r) => r.industry).map((r) => ({ industry: r.industry!, open: r._count._all }))
  },
  ['addressable-industries-v1'],
  { revalidate: 6 * 3600 },
)

export async function loadAddressableMarket(candidateId: string): Promise<AddressableMarket> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { ...PIVOT_PROFILE_SELECT, targetRoleType: true, targetIndustries: true, searchExpansion: true },
  })
  const optedIn = readSearchExpansion(profile.searchExpansion)
  const state = stateCode(profile.currentState)
  // What they're searching for: the role they named, else where they come from.
  const roleKey = (profile.targetRoleType ? roleForTitle(profile.targetRoleType) : null) ?? detectSourceRole({ title: profile.resumeLatestJobTitle, primaryFunction: profile.primaryFunction })
  const role = roleKey ? ROLES.get(roleKey)! : null
  const neighbors = state ? (STATE_NEIGHBORS[state] ?? []) : []
  const band = memberBand(profile.highestLevelReached)
  const bands = band ? [band, BANDS[Math.max(0, BANDS.indexOf(band) - 1)]] : (['IC', 'MANAGER'] as const)
  const remoteOk = wantsRemote(profile.remotePreference)

  const [rows, pivots] = await Promise.all([
    role
      ? prisma.pivotMarketStat
          .findMany({
            where: { roleKey: { in: [role.key, '*'] }, geo: { in: ['US', 'REMOTE', ...(state ? [state] : []), ...neighbors, ...optedIn.states] } },
            select: { roleKey: true, geo: true, band: true, openNow: true, lowCompetitionOpen: true, new30: true, prior30: true, new90: true, prior90: true, payP50: true, paySample: true },
          })
          .catch(() => [] as MarketStatRow[])
      : Promise.resolve([] as MarketStatRow[]),
    loadPivotPaths(profile).catch(() => null),
  ])
  const idx = new StatIndex(rows as MarketStatRow[])
  const b = [...new Set(bands)]
  const national = role ? idx.sum(role.key, 'US', b, 'openNow') : 0
  const remote = role ? idx.sum(role.key, 'REMOTE', b, 'openNow') : 0
  const inState = role && state ? idx.sum(role.key, state, b, 'openNow') : null
  // Their market today, including anything they already opted into.
  const added = role ? optedIn.states.filter((x) => x !== state).reduce((n, x) => n + idx.sum(role.key, x, b, 'openNow'), 0) : 0
  const local = inState === null ? null : inState + (remoteOk || optedIn.remote ? remote : 0) + added
  const trend = role ? bestTrend(idx, role.key, state, b) : null
  const ai = role ? aiOutlookForRole(role.key) : aiOutlookForFunction(profile.primaryFunction)
  const marketReady = idx.size > 0
  const placeLabel = state ? `${stateName(state)}${remoteOk ? ' or remote' : ''}` : remoteOk ? 'remote' : null

  // ── Flags ──
  const flags: MarketFlag[] = []
  if (role && marketReady && local !== null && local < NARROW_BELOW) {
    flags.push({ key: 'narrow', title: 'Your market is narrow', detail: `About ${local} open ${role.label.toLowerCase()} roles at your level in ${placeLabel}. That’s few enough that one or two rejections stall your search.` })
  }
  if (role && marketReady && inState !== null && national > 0 && !remoteOk && !profile.openToRelocation && inState / national < GEO_SHARE_BELOW) {
    flags.push({ key: 'geo', title: 'Where you can work is the limit', detail: `${stateName(state!)} has ${inState} of the ${national.toLocaleString()} open ${role.label.toLowerCase()} roles nationally, and you’re not open to remote or a move.` })
  }
  const contracting = pivots?.contraction.contracting ?? false
  if ((trend && trend.pct <= -0.1) || contracting || ai?.trend === 'shrinking') {
    const bits = [
      trend && trend.pct <= -0.1 ? `New postings for this kind of role are down ${Math.round(Math.abs(trend.pct) * 100)}% versus the period before (${trend.scope}).` : null,
      ai?.trend === 'shrinking' ? `${ai.group} jobs fell ${Math.abs(ai.employmentChangePct).toFixed(1)}% from 2022 to 2026.` : null,
      contracting && pivots?.contraction.headline ? pivots.contraction.headline : null,
    ].filter(Boolean)
    flags.push({ key: 'shrinking', title: 'This market is shrinking', detail: bits.join(' ') })
  }
  if (ai && (ai.aiSkills === 'critical' || ai.aiSkills === 'important')) {
    flags.push({ key: 'ai', title: ai.aiSkills === 'critical' ? 'AI is reshaping this work: learning it is critical' : 'AI is changing this work: learning it matters', detail: `${ai.line} What to learn: ${ai.tools}.` })
  }

  // ── Ways to make it bigger ──
  const expansions: Expansion[] = []
  if (role && marketReady) {
    if (!remoteOk && !optedIn.remote && remote > 0) expansions.push({ kind: 'remote', open: remote, label: `Include remote ${role.label.toLowerCase()} roles` })
    for (const s of neighbors) {
      const n = idx.sum(role.key, s, b, 'openNow')
      if (n >= 5) expansions.push({ kind: 'state', state: s, open: n, label: `Jobs in ${stateName(s)}` })
    }
    if (!profile.openToRelocation && national > (local ?? 0) * 3) expansions.push({ kind: 'relocate', open: national, label: 'Open to a move for the right role' })
  }
  const pivotList: PivotSuggestion[] = pivots ? [...pivots.suggestions, ...pivots.more] : []
  for (const p of pivotList.filter((x) => x.fitLabel !== 'Worth exploring').slice(0, 8)) {
    expansions.push({ kind: 'role', role: p.target, label: p.label, open: p.demand.localOpen ?? p.demand.nationalOpen, fitLabel: p.fitLabel, carry: [...p.brings, ...p.alreadyHave].slice(0, 5), toAdd: p.gaps.map((g) => g.label), ai: p.ai })
  }
  if (role) {
    const have = new Set((profile.targetIndustries ?? []).map((i) => i.toLowerCase()))
    const inds = await industriesForRole(role.key, state ? [state, ...optedIn.states] : optedIn.states, remoteOk || optedIn.remote).catch(() => [])
    for (const i of inds.filter((x) => !have.has(x.industry.toLowerCase())).slice(0, 6)) expansions.push({ kind: 'industry', industry: i.industry, open: i.open, label: i.industry })
  }

  return { role: role ? { key: role.key, label: role.label } : null, placeLabel, local, remote, national, trendPct: trend?.pct ?? null, ai, flags, expansions, optedIn, marketReady }
}
