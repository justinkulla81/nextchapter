import 'server-only'
import { prisma } from '@/lib/prisma'
import type { LeaderboardBoard } from '@prisma/client'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { LEADERBOARD_BOARDS, LEADERBOARD_BOARD_LABEL } from '@/lib/leaderboard/boards'
import { computeBoard } from '@/lib/leaderboard/queries'
import { persistWeeklyBadgesAndNotify } from '@/lib/badges/badge-notifications'

// §17 — "Top three on any weekly board earns a permanent, dated badge."
// Follows the exact same live-compute-then-idempotent-upsert pattern as
// computeWeeklyBadges (src/lib/badges/weekly-badges.ts): the badge itself is
// never the source of truth (this week's rank always is), the upsert is
// just this week's dated archive entry. Written into the SAME
// WeeklyBadgeEarned table weekly-badges.ts already uses — badgeKey is a
// plain String there specifically so new keys like these don't require a
// schema change (see that model's own comment).
export type LeaderboardBadgeKey =
  | 'TOP3_ACTION_SCORE'
  | 'TOP3_OUTREACH'
  | 'TOP3_APPLICATIONS'
  | 'TOP3_VISIBILITY'
  | 'TOP3_CONTRIBUTION'
  | 'TOP3_LIFETIME_ACTION_SCORE'

const BOARD_TO_BADGE_KEY: Record<LeaderboardBoard, LeaderboardBadgeKey> = {
  ACTION_SCORE: 'TOP3_ACTION_SCORE',
  OUTREACH: 'TOP3_OUTREACH',
  APPLICATIONS: 'TOP3_APPLICATIONS',
  VISIBILITY: 'TOP3_VISIBILITY',
  CONTRIBUTION: 'TOP3_CONTRIBUTION',
  LIFETIME_ACTION_SCORE: 'TOP3_LIFETIME_ACTION_SCORE',
}

export const LEADERBOARD_BADGE_LABEL: Record<LeaderboardBadgeKey, string> = Object.fromEntries(
  LEADERBOARD_BOARDS.map((board) => [BOARD_TO_BADGE_KEY[board], `Top 3 — ${LEADERBOARD_BOARD_LABEL[board]}`])
) as Record<LeaderboardBadgeKey, string>

export const LEADERBOARD_BADGE_KEYS: LeaderboardBadgeKey[] = LEADERBOARD_BOARDS.map((board) => BOARD_TO_BADGE_KEY[board])

const TOP_N = 3

// Only meaningful for a candidate who is actually publicly opted in — a
// confidential-mode or opted-out candidate's private "where would I rank"
// number (see computeBoard's `own.optedIn: false`) never earns a public
// Top 3 badge; per §4.1 they earn badges normally on the boards they DO
// participate in, and confidential mode simply means they participate in
// none, not that a hypothetical rank counts.
export async function computeAndRecordLeaderboardBadges(candidateId: string): Promise<void> {
  const weekStartDate = getMondayOfWeek(new Date())
  const results = await Promise.all(LEADERBOARD_BOARDS.map((board) => computeBoard(board, {}, candidateId)))

  const earnedThisWeek = LEADERBOARD_BOARDS.filter((board, i) => {
    const own = results[i].own
    return own?.optedIn && own.rank <= TOP_N && own.value > 0
  })

  if (earnedThisWeek.length === 0) return

  await persistWeeklyBadgesAndNotify(
    candidateId,
    weekStartDate,
    earnedThisWeek.map((board) => ({
      badgeKey: BOARD_TO_BADGE_KEY[board],
      label: LEADERBOARD_BADGE_LABEL[BOARD_TO_BADGE_KEY[board]],
    }))
  )
}

export interface LeaderboardBadgeHistoryEntry {
  badgeKey: LeaderboardBadgeKey
  label: string
  weekStartDate: Date
}

// Full dated history for a candidate — powers "Top 3, Outreach, week of Aug
// 10" display on the leaderboard and Community profile (§17). Never read by
// anything Dossier-related (see dossier-sections.ts / recruiter-report.ts,
// confirmed by investigation neither imports WeeklyBadgeEarned at all).
export async function getLeaderboardBadgeHistory(candidateId: string): Promise<LeaderboardBadgeHistoryEntry[]> {
  const keys: string[] = Object.values(BOARD_TO_BADGE_KEY)
  const rows = await prisma.weeklyBadgeEarned.findMany({
    where: { candidateId, badgeKey: { in: keys } },
    orderBy: { weekStartDate: 'desc' },
  })
  return rows.map((r) => ({
    badgeKey: r.badgeKey as LeaderboardBadgeKey,
    label: LEADERBOARD_BADGE_LABEL[r.badgeKey as LeaderboardBadgeKey],
    weekStartDate: r.weekStartDate,
  }))
}
