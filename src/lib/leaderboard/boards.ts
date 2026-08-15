// PART FOUR §13-14 — the 6 Weekly Leaderboards. Shared types/constants only;
// the actual live aggregation queries live in queries.ts, kept separate so
// this file (labels, ordering, display copy) can be imported from client
// components without dragging `server-only` code along.
//
// Points are NOT the grade (§13) — nothing in this directory ever reads or
// writes MarketRealityComponentScore/computeDossierCompetencies, and nothing
// in the grade path reads anything from here. Two architecturally separate
// code paths, on purpose.

import type { LeaderboardBoard } from '@prisma/client'

export const LEADERBOARD_BOARDS: LeaderboardBoard[] = [
  'ACTION_SCORE',
  'OUTREACH',
  'APPLICATIONS',
  'VISIBILITY',
  'CONTRIBUTION',
  'LIFETIME_ACTION_SCORE',
]

// The 5 that reset weekly Monday 00:00 member-local (§14) — everything
// except Lifetime, which accumulates. Used to gate which boards even have a
// LeaderboardPersonalBest row (see personal-bests.ts) and which get a fresh
// weekStartDate-scoped query each render.
export const WEEKLY_RESET_BOARDS: LeaderboardBoard[] = ['ACTION_SCORE', 'OUTREACH', 'APPLICATIONS', 'VISIBILITY', 'CONTRIBUTION']

export const LEADERBOARD_BOARD_LABEL: Record<LeaderboardBoard, string> = {
  ACTION_SCORE: 'Action Score',
  OUTREACH: 'Outreach',
  APPLICATIONS: 'Applications',
  VISIBILITY: 'Visibility',
  CONTRIBUTION: 'Contribution',
  LIFETIME_ACTION_SCORE: 'Lifetime Action Score',
}

// What each board actually counts (§14) — plain, honest copy shown on the
// leaderboard itself and in settings, not marketing language. CONTRIBUTION's
// wording is the explicit product decision for this build: this codebase has
// no comment/reply model on CommunityPost at all (reactions are the only
// signal that exists), so the copy says exactly that rather than implying a
// "reply or reaction" board that doesn't exist.
export const LEADERBOARD_BOARD_DESCRIPTION: Record<LeaderboardBoard, string> = {
  ACTION_SCORE: 'Total Action Points earned this week.',
  OUTREACH: 'Distinct people messaged this week.',
  APPLICATIONS: 'Applications logged this week.',
  VISIBILITY: 'LinkedIn posts published through the Marketing Plan this week.',
  CONTRIBUTION: 'Posts that got a reaction from another member this week.',
  LIFETIME_ACTION_SCORE: 'Cumulative Action Points, all-time.',
}

export const LEADERBOARD_BOARD_UNIT: Record<LeaderboardBoard, string> = {
  ACTION_SCORE: 'points',
  OUTREACH: 'people reached',
  APPLICATIONS: 'applications',
  VISIBILITY: 'posts',
  CONTRIBUTION: 'posts',
  LIFETIME_ACTION_SCORE: 'points',
}

// §15 — top 10 shown publicly, never a full ranking.
export const LEADERBOARD_PUBLIC_SIZE = 10
// §18 — own position shown only inside the top 25; below that, progress
// framing only, never a raw rank number.
export const LEADERBOARD_OWN_RANK_VISIBLE_THRESHOLD = 25

// §15 "Segment by seniority band, matching Community." Duplicated here
// (rather than imported from segmentation.ts / community/groups.ts) because
// this file is deliberately client-safe — no `server-only` import anywhere
// in it — so filter UI (LeaderboardFilters.tsx, a Client Component) can use
// these labels without dragging in Prisma. segmentation.ts's
// SeniorityBand-typed constant is the source of truth for server-side
// query code; these four literal strings are the same real values
// (ResumeAnalysis.seniorityBand), just duplicated as plain strings so this
// file has zero server-only dependencies.
export const SENIORITY_BANDS = ['EARLY', 'MID', 'SENIOR', 'EXECUTIVE'] as const
export const SENIORITY_BAND_LABEL: Record<string, string> = {
  EARLY: 'Early Career',
  MID: 'Mid-Career',
  SENIOR: 'Senior',
  EXECUTIVE: 'Executive',
}

export interface LeaderboardEntry {
  candidateId: string
  value: number
  rank: number // 1-indexed, ties broken by earliest achievement per Build Notes
  displayName: string | null // null only for NOT_LISTED
}
