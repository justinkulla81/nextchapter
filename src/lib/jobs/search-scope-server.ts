import 'server-only'
import { prisma } from '@/lib/prisma'
import { postingFunctions } from '@/lib/jobs/job-fit-bucket'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { jobIndustryBucket } from '@/lib/profile/industry-reading'
import { activeTargets, pivotOf } from '@/lib/journey/pivot'
import { ROLES } from '@/lib/pivots/pivot-map'
import { pivotMessage, type PivotMessage } from '@/lib/journey/pivot-scope-message'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import {
  behaviorPointsOutside, exploreQuestion, homeOf, outsideHome, pivotMessageDue, readExploredOptions, readPivotScopeState, resolveScope, scopeFor,
  withRadarFunctions, type BehaviorSignal, type ExploreQuestion, type ExploredOption, type Home, type OutsideHome, type ResolvedScope, type SearchScope,
} from '@/lib/jobs/search-scope'

const SAVES_LOOKED_AT = 60

/**
 * Where a member's saved jobs point: function, industry and state, counted. Saves only: contacts carry no
 * industry or function of their own, so they do not feed the question. Read-only; it never writes to the profile.
 */
export async function loadBehaviorSignals(candidateId: string): Promise<BehaviorSignal[]> {
  const saved = await prisma.trackedJob.findMany({
    where: { candidateId, source: 'job_board', savedAt: { not: null }, dismissedAt: null },
    orderBy: { savedAt: 'desc' },
    take: SAVES_LOOKED_AT,
    select: { sourceId: true },
  })
  if (saved.length === 0) return []
  const postings = await prisma.exclusiveJobPosting.findMany({
    where: { id: { in: saved.map((s) => s.sourceId) } },
    select: { title: true, targetFunction: true, industry: true, location: true },
  })
  const counts = new Map<string, BehaviorSignal>()
  const bump = (kind: BehaviorSignal['kind'], value: string | null | undefined) => {
    if (!value) return
    const key = `${kind}:${value.toLowerCase()}`
    const prev = counts.get(key)
    counts.set(key, prev ? { ...prev, count: prev.count + 1 } : { kind, value, count: 1, source: 'saves' })
  }
  for (const p of postings) {
    bump('function', postingFunctions(p)[0])
    bump('industry', jobIndustryBucket(p.industry))
    bump('place', statesFromLocation(p.location).states[0])
  }
  return [...counts.values()]
}

export interface ScopeContext {
  scope: SearchScope
  resolved: ResolvedScope
  home: Home
  outside: OutsideHome
  options: ExploredOption[]
  message: PivotMessage | null
  question: ExploreQuestion | null
  /** Saves point outside home but nothing was confirmed: only the coach offer reads this. */
  behaviorOutside: boolean
}

type ScopeProfile = {
  id: string
  journeyDetails: unknown
  searchExpansion: unknown
  targetIndustries: string[]
  primaryFunction: string | null
  secondaryFunction: string | null
  targetFunction: string | null
  industryContext: string | null
  secondaryIndustryContext: string | null
  currentState: string | null
  resumeKeywords: string[]
  levelRankScore?: number | null
}

/** Everything the jobs page needs to read the scope: resolved areas, the pivot flag, the once-only message and the question. */
export async function loadScopeContext(p: ScopeProfile, urlScope?: string | string[] | null, opts: { withBehavior?: boolean } = {}): Promise<ScopeContext> {
  const details = p.journeyDetails
  const saved = (details as { searchScope?: unknown } | null)?.searchScope
  const scope = scopeFor(typeof saved === 'string' ? saved : null, urlScope)
  const expansion = readSearchExpansion(p.searchExpansion)
  const radar = activeTargets(pivotOf(details)).map((t) => t.function)
  const options = withRadarFunctions(readExploredOptions(details), radar)
  const resolved = resolveScope({ scope, expansion, options, targetIndustries: p.targetIndustries })
  const home = homeOf(p, expansion)
  const outside = outsideHome(resolved.active, home, (key) => ROLES.get(key)?.fn ?? null)
  const state = readPivotScopeState(details)
  const signals = opts.withBehavior === false ? [] : await loadBehaviorSignals(p.id).catch(() => [])
  return {
    scope,
    resolved,
    home,
    outside,
    options,
    message: pivotMessageDue(state, outside) ? pivotMessage({ outside, homeFunction: p.primaryFunction, keywords: p.resumeKeywords }) : null,
    question: exploreQuestion(signals, home, options, state, expansion),
    behaviorOutside: behaviorPointsOutside(signals, home),
  }
}
