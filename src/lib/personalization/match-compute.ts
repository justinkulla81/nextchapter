import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { loadMemberMarketRows, type BoardRankRow } from '@/lib/jobs/board-shortlist'
import { loadBreadthClassifier, type BreadthClassifier } from '@/lib/jobs/search-breadth-server'
import { loadDismissRules } from '@/lib/jobs/job-dismiss-server'
import { boardListingFitBucketScorerFor } from '@/lib/jobs/email-fit-scoring'
import { FIT_BUCKET_SORT_RANK } from '@/lib/jobs/fit-bucket-types'
import { sectorKeep } from '@/lib/jobs/employer-sector'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { flagsFromTags, holdsClearance, isClearedJobFor, requirementMemberOf, type RequirementProfile } from '@/lib/jobs/requirements'
import type { ActivePreference, PreferenceAction, PreferenceKind } from '@/lib/jobs/job-dismiss'
import { countVerdicts, isMatch, verdictOf, type MatchCounts, type Verdict } from '@/lib/personalization/match-verdict'
import type { SnapshotPreference } from '@/lib/personalization/match-inputs'

// One run of a member's matching over every live job in their level window: each job's
// verdict (match-verdict.ts), the counts, and what the "What we know about you" card needs
// (how many matches a missing signal leaves unchecked). The same criteria and fit scorer as
// the board (board-shortlist.ts rankBoardRows, relevance.ts ringOf); no model call, no paid API.

export type MatchProfile = CandidateProfile & { socOverride?: string | null }

export interface MatchState {
  verdicts: Map<string, Verdict>
  counts: MatchCounts
  classifier: BreadthClassifier
  ms: number
  /** Over the member's matches. */
  geoUnchecked: number
  skillsUnchecked: number
  industryKnown: number
  clearanceAsked: number
  clearanceMet: number
  /** Matches posted in the last 7 days; and those whose skills and tools match (strong). */
  newThisWeek: number
  newThisWeekSkills: number
  /** Jobs they passed on themselves; and jobs hidden because of what those taught (a company, a pay floor, "Hide all"). */
  passedOn: number
  hiddenLikeThem: number
}

const WEEK_MS = 7 * 86_400_000
const remoteMemo = new Map<string, boolean>()
function isRemote(p: Pick<BoardRankRow, 'location' | 'targetRemotePolicy'>): boolean {
  if ((p.targetRemotePolicy ?? '').toLowerCase() === 'remote') return true
  const key = p.location ?? ''
  let hit = remoteMemo.get(key)
  if (hit === undefined) {
    hit = statesFromLocation(p.location).isRemote
    if (remoteMemo.size > 100_000) remoteMemo.clear()
    remoteMemo.set(key, hit)
  }
  return hit
}

function asActive(prefs: SnapshotPreference[]): ActivePreference[] {
  return prefs.map((p, i) => ({ id: `snap-${i}`, kind: p.kind as PreferenceKind, value: p.value, label: p.label, count: p.count, action: p.action as PreferenceAction, askedAt: null }))
}

// The last few runs per member, kept a minute: the card, the board line and the market block
// all read the same run within one page view.
const RUN_TTL_MS = 60_000
const runs = new Map<string, { at: number; rows: BoardRankRow[]; value: Promise<MatchState | null> }>()

/**
 * The member's matching over their level window. `dismiss`: an earlier set of dismiss
 * preferences (a past profile), else their live ones. `live`: the board's per-row placement
 * memo is shared (current profile only — a past profile would crowd it).
 * Null when matching has nothing to go on (no function, occupation or pivot role).
 */
export async function computeMatchState(profile: MatchProfile, opts: { dismiss?: SnapshotPreference[]; live?: boolean } = {}): Promise<MatchState | null> {
  const rows = await loadMemberMarketRows(profile)
  const key = opts.live ? `${profile.id}|${profile.updatedAt?.getTime?.() ?? ''}` : null
  if (key) {
    const hit = runs.get(key)
    if (hit && hit.rows === rows && Date.now() - hit.at < RUN_TTL_MS) return hit.value
  }
  const value = run(profile, rows, opts)
  if (key) {
    if (runs.size > 50) runs.clear()
    runs.set(key, { at: Date.now(), rows, value })
    value.catch(() => runs.delete(key))
  }
  return value
}

async function run(profile: MatchProfile, rows: BoardRankRow[], opts: { dismiss?: SnapshotPreference[]; live?: boolean }): Promise<MatchState | null> {
  const started = Date.now()
  const [classifier, rules] = await Promise.all([
    loadBreadthClassifier(profile),
    loadDismissRules(profile.id, opts.dismiss ? asActive(opts.dismiss) : undefined).catch(() => null),
  ])
  if (!classifier) return null
  const keepSector = sectorKeep(profile.hiddenEmployerSectors)
  const fit = boardListingFitBucketScorerFor('v2', profile)
  const reqMember = requirementMemberOf(profile as unknown as RequirementProfile)
  const holds = holdsClearance(reqMember)
  const placed = !!classifier.member.geo?.anchor
  const toolsConfirmed = !!profile.toolsConfirmedAt
  const weekAgo = Date.now() - WEEK_MS
  const verdicts = new Map<string, Verdict>()
  let geoUnchecked = 0
  let skillsUnchecked = 0
  let industryKnown = 0
  let clearanceAsked = 0
  let clearanceMet = 0
  let newThisWeek = 0
  let newThisWeekSkills = 0
  let hiddenLikeThem = 0
  for (const p of rows) {
    if (keepSector && !keepSector(p)) continue
    if (rules?.hidden(p)) {
      verdicts.set(p.id, verdictOf({ dismissed: true }))
      if (!rules.dismissedIds.has(p.id)) hiddenLikeThem++
      continue
    }
    const crit = (opts.live ? classifier.place(p)?.crit : undefined) ?? classifier.criteria(p).crit
    const fails = {
      location: crit.geo !== 0,
      field: crit.fn !== 'own',
      skills: !(crit.skills === 'strong' || crit.skills === 'unknown'),
      industry: crit.industry !== 'own',
    }
    let strong = false
    // Fit only where it can decide something: a match's strength, or the industry criterion (relevance.ts ringOf).
    if (!fails.location && !fails.field && !fails.skills) {
      strong = FIT_BUCKET_SORT_RANK[fit(p)] === 0
      if (fails.industry && strong) fails.industry = false
    }
    const v = verdictOf(fails, strong)
    verdicts.set(p.id, v)
    if (!isMatch(v)) continue
    if (!placed && !isRemote(p)) geoUnchecked++
    if (crit.skills === 'unknown') skillsUnchecked++
    if (crit.industryName) industryKnown++
    if (p.requirementTags?.includes('clearance')) {
      clearanceAsked++
      if (holds && isClearedJobFor(flagsFromTags(p.requirementTags), reqMember)) clearanceMet++
    }
    if ((p.postedAt ?? p.createdAt).getTime() >= weekAgo) {
      newThisWeek++
      if (toolsConfirmed && crit.skills === 'strong') newThisWeekSkills++
    }
  }
  return {
    verdicts,
    counts: countVerdicts(verdicts),
    classifier,
    ms: Date.now() - started,
    geoUnchecked,
    skillsUnchecked,
    industryKnown,
    clearanceAsked,
    clearanceMet,
    newThisWeek,
    newThisWeekSkills,
    passedOn: rules?.dismissedIds.size ?? 0,
    hiddenLikeThem,
  }
}
