import 'server-only'
import { prisma } from '@/lib/prisma'
import type { LeaderboardBoard, LeaderboardDisplayMode } from '@prisma/client'
import type { SeniorityBand } from '@/lib/scoring/resume-analysis/types'
import { getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { getEarnedPoints } from '@/lib/weekly/action-effort'
import { resolveLeaderboardIdentity } from '@/lib/leaderboard/identity'
import { getSeniorityBandsForCandidates } from '@/lib/leaderboard/segmentation'
import { LEADERBOARD_PUBLIC_SIZE, LEADERBOARD_BOARDS, type LeaderboardEntry } from '@/lib/leaderboard/boards'

// PART FOUR §13-20 — the live aggregation queries behind all 6 boards. Every
// board is computed fresh from real source rows on every call — no cached
// counters, no append-only ledger table of our own. This is a deliberate
// reuse of this codebase's existing "compute live from source rows, never
// store a mutable running total" convention (see computeWeeklyBadges,
// computeMilestoneBadges, computeDossierCompetencies) — it's what makes the
// spec's "any action reversed, removed, or moderated retroactively
// decrements points" anti-gaming rule (§16) true BY CONSTRUCTION: a
// cancelled application, a deleted reaction, or a post that gets moderated
// to REMOVED simply stops being counted the next time this file runs a
// query, with no separate reversal step to remember. Same reasoning gives
// leaderboard opt-out (§18 "immediate and retroactive") for free — there's
// no cache to invalidate.
//
// §15/§4.1 hard exclusion: every query below filters on
// `confidentialSearchMode: false` AND `leaderboardOptIn: true` at the
// Prisma `where` clause, never as a later in-memory filter — see
// getEligibleCandidatePool, the single choke point every board goes
// through. A Confidential Search Mode candidate can never appear here
// regardless of leaderboardOptIn's value (and never even sees the opt-in
// control — see LeaderboardOptInSettings.tsx).

// Judgment calls, not spec numbers — documented so a future change is a
// one-line edit, not an archaeology project. Applications' 15/day is the
// one real spec number (§16); the rest have no stated value.
const OUTREACH_DAILY_CAP = 10
const APPLICATIONS_DAILY_CAP = 15
const VISIBILITY_MIN_DIRECT_POST_LENGTH = 25

interface RawScore {
  candidateId: string
  value: number
  // Epoch ms of whatever real event is closest to "when this candidate
  // reached their current value" — ascending order wins ties, approximating
  // the Build Notes' "ties break by earliest achievement" without needing a
  // real event-timestamped ledger (this codebase deliberately doesn't keep
  // one — see the file header). Falls back to the week start / candidate
  // creation for a true zero, so untouched candidates still sort stably.
  tiebreakAt: number
}

export interface BoardFilter {
  seniorityBand?: SeniorityBand
  function?: string
}

export interface BoardResult {
  board: LeaderboardBoard
  weekStartDate: Date | null // null only for LIFETIME_ACTION_SCORE
  top10: LeaderboardEntry[]
  eligibleCount: number
  // Always populated when a requestingCandidateId was passed, REGARDLESS of
  // whether they're publicly opted in — §4.1/§15: "[confidential-mode
  // members] still see their own rank, personal bests, and badges
  // privately." `rank` here is real (computed the same way, with the same
  // anti-gaming guards) even for a candidate who never appears in `top10` or
  // counts toward `eligibleCount` — it answers "where would I stand," not
  // "where do I appear publicly." `optedIn` tells the UI which of those two
  // things this is, so it can render "you're privately #4" differently from
  // a real public position.
  own: { rank: number; value: number; optedIn: boolean } | null
}

interface EligibleCandidate {
  id: string
  firstName: string | null
  lastName: string | null
  leaderboardDisplayMode: LeaderboardDisplayMode
  primaryFunction: string | null
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function getEligibleCandidatePool(filter: BoardFilter): Promise<EligibleCandidate[]> {
  const rows = await prisma.candidateProfile.findMany({
    where: {
      confidentialSearchMode: false,
      leaderboardOptIn: true,
      leaderboardDisplayMode: { not: null },
      ...(filter.function ? { primaryFunction: filter.function } : {}),
    },
    select: { id: true, firstName: true, lastName: true, leaderboardDisplayMode: true, primaryFunction: true },
  })
  // `leaderboardDisplayMode: { not: null }` in the where clause guarantees
  // every row's value is non-null; Prisma's generated type doesn't narrow
  // that for us.
  const candidates = rows.map((r) => ({ ...r, leaderboardDisplayMode: r.leaderboardDisplayMode! }))

  if (!filter.seniorityBand) return candidates
  const bands = await getSeniorityBandsForCandidates(candidates.map((c) => c.id))
  return candidates.filter((c) => bands.get(c.id) === filter.seniorityBand)
}

function mergeWithPool(pool: EligibleCandidate[], raw: RawScore[], zeroTiebreakAt: number): RawScore[] {
  const byId = new Map(raw.map((r) => [r.candidateId, r]))
  return pool.map((c) => byId.get(c.id) ?? { candidateId: c.id, value: 0, tiebreakAt: zeroTiebreakAt })
}

function rankAndSlice(
  merged: RawScore[],
  requestingCandidateId: string | null
): { ranked: (RawScore & { rank: number })[]; own: { rank: number; value: number } | null } {
  const sorted = [...merged].sort((a, b) => b.value - a.value || a.tiebreakAt - b.tiebreakAt)
  const ranked = sorted.map((r, i) => ({ ...r, rank: i + 1 }))
  const ownRow = requestingCandidateId ? ranked.find((r) => r.candidateId === requestingCandidateId) : undefined
  return { ranked, own: ownRow ? { rank: ownRow.rank, value: ownRow.value } : null }
}

// ── Per-board raw score computation ─────────────────────────────────────

// Action Score — reuses action-effort.ts's getEarnedPoints over
// WeeklySprint.committedActions, the system's existing weekly "points"
// concept, exactly as instructed. Deliberately reads committedActions
// directly (no reconcileVerifiedActions pass) — same convention
// computeWeeklyBadges already uses for this same JSON blob, so the number
// shown here always agrees with the weekly badges' own math.
async function computeActionScoreRaw(candidateIds: string[], weekStartDate: Date): Promise<RawScore[]> {
  const sprints = await prisma.weeklySprint.findMany({
    where: { candidateId: { in: candidateIds }, weekStartDate },
    select: { candidateId: true, committedActions: true },
  })
  return sprints.map((s) => {
    const actions = s.committedActions as unknown as CommittedAction[]
    const value = actions.reduce((sum, a) => sum + getEarnedPoints(a), 0)
    const completedTimes = actions
      .filter((a) => a.completed && a.completedAt)
      .map((a) => new Date(a.completedAt!).getTime())
    const tiebreakAt = completedTimes.length > 0 ? Math.max(...completedTimes) : weekStartDate.getTime()
    return { candidateId: s.candidateId, value, tiebreakAt }
  })
}

async function computeLifetimeActionScoreRaw(candidateIds: string[]): Promise<RawScore[]> {
  const sprints = await prisma.weeklySprint.findMany({
    where: { candidateId: { in: candidateIds } },
    select: { candidateId: true, committedActions: true },
  })
  const byCandidate = new Map<string, { value: number; tiebreakAt: number }>()
  for (const s of sprints) {
    const actions = s.committedActions as unknown as CommittedAction[]
    const value = actions.reduce((sum, a) => sum + getEarnedPoints(a), 0)
    const completedTimes = actions
      .filter((a) => a.completed && a.completedAt)
      .map((a) => new Date(a.completedAt!).getTime())
    const existing = byCandidate.get(s.candidateId) ?? { value: 0, tiebreakAt: 0 }
    byCandidate.set(s.candidateId, {
      value: existing.value + value,
      tiebreakAt: Math.max(existing.tiebreakAt, ...completedTimes, 0),
    })
  }
  return [...byCandidate.entries()].map(([candidateId, v]) => ({ candidateId, ...v }))
}

// Outreach — §16: distinct recipients only, daily counted cap. Duplicate/
// near-duplicate body detection is deliberately NOT implemented: OutreachLog
// has never captured message text anywhere in this codebase (confirmed
// across all 3 write paths — network/actions.ts's logOutreach, and the
// Gmail/Calendar auto-detect syncs — none pass a body/text field at all),
// so there is no real content to hash or compare. Building a message-body
// capture UI is out of scope for this phase; noted here rather than adding
// inert schema/fields nothing populates.
async function computeOutreachRaw(candidateIds: string[], weekStartDate: Date): Promise<RawScore[]> {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000)
  const rows = await prisma.outreachLog.findMany({
    where: { candidateId: { in: candidateIds }, contactId: { not: null }, loggedAt: { gte: weekStartDate, lt: weekEnd } },
    select: { candidateId: true, contactId: true, loggedAt: true },
    orderBy: { loggedAt: 'asc' },
  })
  const byCandidate = new Map<string, typeof rows>()
  for (const r of rows) byCandidate.set(r.candidateId, [...(byCandidate.get(r.candidateId) ?? []), r])

  const result: RawScore[] = []
  for (const [candidateId, candidateRows] of byCandidate) {
    const byDay = new Map<string, typeof rows>()
    for (const r of candidateRows) byDay.set(dayKey(r.loggedAt), [...(byDay.get(dayKey(r.loggedAt)) ?? []), r])

    const countedContactIds = new Set<string>()
    const countedTimes: number[] = []
    for (const dayRows of byDay.values()) {
      let countedToday = 0
      for (const r of dayRows) {
        if (countedToday >= OUTREACH_DAILY_CAP) break
        if (!r.contactId || countedContactIds.has(r.contactId)) continue
        countedContactIds.add(r.contactId)
        countedTimes.push(r.loggedAt.getTime())
        countedToday++
      }
    }
    result.push({
      candidateId,
      value: countedContactIds.size,
      tiebreakAt: countedTimes.length > 0 ? Math.max(...countedTimes) : weekStartDate.getTime(),
    })
  }
  return result
}

// Applications — §16: self-logged and trusted (no extra verification check),
// cap 15/day counted (the spec's own literal number), duplicate job URLs
// don't count twice. JobPosting.url has no unique constraint (confirmed —
// only @@index([candidateId, createdAt])), so a candidate can genuinely have
// two rows for the same posting (re-imported, re-analyzed); dedup happens
// here at query time by normalized URL rather than at the schema level, so
// it doesn't require a migration that could reject/collide with existing
// duplicate rows in seeded or real data. Rows with no URL (EMAIL_DETECTED
// source) have nothing to dedupe against, so each always counts on its own.
async function computeApplicationsRaw(candidateIds: string[], weekStartDate: Date): Promise<RawScore[]> {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000)
  const rows = await prisma.jobPosting.findMany({
    where: { candidateId: { in: candidateIds }, appliedAt: { gte: weekStartDate, lt: weekEnd } },
    select: { candidateId: true, url: true, appliedAt: true },
    orderBy: { appliedAt: 'asc' },
  })
  const byCandidate = new Map<string, typeof rows>()
  for (const r of rows) byCandidate.set(r.candidateId, [...(byCandidate.get(r.candidateId) ?? []), r])

  const result: RawScore[] = []
  for (const [candidateId, candidateRows] of byCandidate) {
    const byDay = new Map<string, typeof rows>()
    for (const r of candidateRows) {
      const key = dayKey(r.appliedAt!)
      byDay.set(key, [...(byDay.get(key) ?? []), r])
    }

    const seenUrls = new Set<string>()
    let value = 0
    const countedTimes: number[] = []
    for (const dayRows of byDay.values()) {
      let countedToday = 0
      for (const r of dayRows) {
        if (countedToday >= APPLICATIONS_DAILY_CAP) break
        if (r.url) {
          const key = r.url.trim().toLowerCase()
          if (seenUrls.has(key)) continue
          seenUrls.add(key)
        }
        value++
        countedTimes.push(r.appliedAt!.getTime())
        countedToday++
      }
    }
    result.push({ candidateId, value, tiebreakAt: countedTimes.length > 0 ? Math.max(...countedTimes) : weekStartDate.getTime() })
  }
  return result
}

// Visibility — §16: minimum post length, one counted post per day.
// Minimum length is only checkable for DIRECT_POST rows (the only write
// path with real text — see LinkedInActivityLog.textLength's schema
// comment); SELF_REPORT rows ("I posted today," no compose UI in this app)
// have no text to measure and are exempted, same trust-based treatment the
// self-report path already has everywhere else in this codebase.
async function computeVisibilityRaw(candidateIds: string[], weekStartDate: Date): Promise<RawScore[]> {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000)
  const rows = await prisma.linkedInActivityLog.findMany({
    where: { candidateId: { in: candidateIds }, loggedAt: { gte: weekStartDate, lt: weekEnd } },
    select: { candidateId: true, loggedAt: true, source: true, textLength: true },
  })
  const qualifying = rows.filter((r) => r.source !== 'DIRECT_POST' || r.textLength === null || r.textLength >= VISIBILITY_MIN_DIRECT_POST_LENGTH)

  const byCandidate = new Map<string, Map<string, Date>>() // candidateId -> day -> earliest qualifying loggedAt
  for (const r of qualifying) {
    const dayMap = byCandidate.get(r.candidateId) ?? new Map<string, Date>()
    const key = dayKey(r.loggedAt)
    if (!dayMap.has(key) || r.loggedAt < dayMap.get(key)!) dayMap.set(key, r.loggedAt)
    byCandidate.set(r.candidateId, dayMap)
  }

  return [...byCandidate.entries()].map(([candidateId, dayMap]) => {
    const times = [...dayMap.values()].map((d) => d.getTime())
    return { candidateId, value: dayMap.size, tiebreakAt: times.length > 0 ? Math.max(...times) : weekStartDate.getTime() }
  })
}

// Contribution — §16: must clear moderation AND receive a reaction from
// another member (not the post's own author). Self-reactions are NOT
// prevented at the reaction-creation level today (confirmed —
// toggleCheerPostAction in community/actions.ts has no author check), so
// this filter is real load-bearing logic, not a redundant belt-and-braces
// check. Reactions-only per this build's product decision — this codebase
// has no comment/reply model on CommunityPost at all.
async function computeContributionRaw(candidateIds: string[], weekStartDate: Date): Promise<RawScore[]> {
  const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000)
  const posts = await prisma.communityPost.findMany({
    where: {
      candidateId: { in: candidateIds },
      moderationStatus: 'PUBLISHED',
      createdAt: { gte: weekStartDate, lt: weekEnd },
    },
    select: { candidateId: true, createdAt: true, reactions: { select: { candidateId: true } } },
  })

  const byCandidate = new Map<string, { value: number; times: number[] }>()
  for (const post of posts) {
    const hasRealReaction = post.reactions.some((r) => r.candidateId !== post.candidateId)
    if (!hasRealReaction) continue
    const existing = byCandidate.get(post.candidateId) ?? { value: 0, times: [] }
    existing.value++
    existing.times.push(post.createdAt.getTime())
    byCandidate.set(post.candidateId, existing)
  }

  return [...byCandidate.entries()].map(([candidateId, { value, times }]) => ({
    candidateId,
    value,
    tiebreakAt: times.length > 0 ? Math.max(...times) : weekStartDate.getTime(),
  }))
}

async function computeRawForBoard(board: LeaderboardBoard, candidateIds: string[], weekStartDate: Date | null): Promise<RawScore[]> {
  switch (board) {
    case 'ACTION_SCORE':
      return computeActionScoreRaw(candidateIds, weekStartDate!)
    case 'OUTREACH':
      return computeOutreachRaw(candidateIds, weekStartDate!)
    case 'APPLICATIONS':
      return computeApplicationsRaw(candidateIds, weekStartDate!)
    case 'VISIBILITY':
      return computeVisibilityRaw(candidateIds, weekStartDate!)
    case 'CONTRIBUTION':
      return computeContributionRaw(candidateIds, weekStartDate!)
    case 'LIFETIME_ACTION_SCORE':
      return computeLifetimeActionScoreRaw(candidateIds)
  }
}

// The one exported entry point every UI surface (Stats page, Community
// module, badge computation, personal bests) goes through.
// requestingCandidateId is who's asking — used only to compute `own`, never
// to change what's eligible/public.
export async function computeBoard(
  board: LeaderboardBoard,
  filter: BoardFilter,
  requestingCandidateId: string | null
): Promise<BoardResult> {
  const weekStartDate = board === 'LIFETIME_ACTION_SCORE' ? null : getMondayOfWeek(new Date())
  const pool = await getEligibleCandidatePool(filter)

  if (pool.length === 0) {
    const privateOwn = requestingCandidateId
      ? await computePrivateOwn(board, requestingCandidateId, weekStartDate)
      : null
    return { board, weekStartDate, top10: [], eligibleCount: 0, own: privateOwn }
  }

  const raw = await computeRawForBoard(board, pool.map((c) => c.id), weekStartDate)
  const merged = mergeWithPool(pool, raw, (weekStartDate ?? new Date(0)).getTime())
  const { ranked, own } = rankAndSlice(merged, requestingCandidateId)

  const identityById = new Map(pool.map((p) => [p.id, resolveLeaderboardIdentity(p)]))
  const top10: LeaderboardEntry[] = ranked.slice(0, LEADERBOARD_PUBLIC_SIZE).map((r) => ({
    candidateId: r.candidateId,
    value: r.value,
    rank: r.rank,
    displayName: identityById.get(r.candidateId) ?? null,
  }))

  let finalOwn: BoardResult['own'] = own ? { ...own, optedIn: true } : null
  // Requesting candidate wasn't in the eligible pool (confidential mode,
  // opted out, or filtered out by this particular band/function view) —
  // §4.1/§15 still promises them a real private rank/value. Insert their
  // own live value into the already-ranked pool to find where it WOULD
  // land, without adding them to eligibleCount or top10 (they're not
  // actually part of either — this is a private "where do I stand" read).
  if (!finalOwn && requestingCandidateId) {
    finalOwn = await computePrivateOwn(board, requestingCandidateId, weekStartDate, ranked)
  }

  return { board, weekStartDate, top10, eligibleCount: ranked.length, own: finalOwn }
}

// Computes a candidate's real value + hypothetical rank against `ranked`
// (a pool they are NOT a member of) — or, if no pool exists yet at all
// (ranked omitted), their value with rank 1 (trivially first among nobody).
// Guard-applying: goes through the exact same per-board raw computation as
// the public pool, so a confidential-mode or opted-out candidate's private
// number is exactly as real/anti-gamed as anyone else's.
async function computePrivateOwn(
  board: LeaderboardBoard,
  candidateId: string,
  weekStartDate: Date | null,
  ranked?: (RawScore & { rank: number })[]
): Promise<{ rank: number; value: number; optedIn: boolean }> {
  const raw = await computeRawForBoard(board, [candidateId], weekStartDate)
  const value = raw[0]?.value ?? 0
  if (!ranked || ranked.length === 0) {
    return { rank: 1, value, optedIn: false }
  }
  const tiebreakAt = raw[0]?.tiebreakAt ?? Date.now()
  const better = ranked.filter((r) => r.value > value || (r.value === value && r.tiebreakAt < tiebreakAt)).length
  return { rank: better + 1, value, optedIn: false }
}

// Convenience for pages that need every board at once (Stats page) — same
// filter applied across all 6, one Promise.all.
export async function computeAllBoards(filter: BoardFilter, requestingCandidateId: string | null): Promise<BoardResult[]> {
  return Promise.all(LEADERBOARD_BOARDS.map((board) => computeBoard(board, filter, requestingCandidateId)))
}
