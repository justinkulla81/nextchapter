import 'server-only'
import { prisma } from '@/lib/prisma'
import type { LeaderboardBoard } from '@prisma/client'
import { WEEKLY_RESET_BOARDS } from '@/lib/leaderboard/boards'
import { computeBoard, type BoardFilter } from '@/lib/leaderboard/queries'

// §18/§20 — "personal best shown alongside every board," "best week,
// longest streak, most outreach in a week." Write-through cache of the
// running max: every time this runs for a candidate, it compares that
// candidate's CURRENT live board value against the stored best and upserts
// only when the live value is higher. Safe to call as often as every page
// render (idempotent — a no-op update when nothing's improved) and safe
// under retroactive decrements: the live value being compared in has
// already passed every anti-gaming guard in queries.ts, so a number that
// only looked good because of gaming was never eligible to become the
// stored best in the first place. LIFETIME_ACTION_SCORE is deliberately
// excluded — see LeaderboardPersonalBest's schema comment.
export async function getAndUpdatePersonalBests(
  candidateId: string
): Promise<Record<LeaderboardBoard, { bestValue: number; weekStartDate: Date } | null>> {
  const filter: BoardFilter = {}
  const [stored, ...liveResults] = await Promise.all([
    prisma.leaderboardPersonalBest.findMany({ where: { candidateId } }),
    ...WEEKLY_RESET_BOARDS.map((board) => computeBoard(board, filter, candidateId)),
  ])

  const storedByBoard = new Map(stored.map((s) => [s.board, s]))
  const updates: Promise<unknown>[] = []
  const result: Record<string, { bestValue: number; weekStartDate: Date } | null> = {
    ACTION_SCORE: null,
    OUTREACH: null,
    APPLICATIONS: null,
    VISIBILITY: null,
    CONTRIBUTION: null,
    LIFETIME_ACTION_SCORE: null, // never tracked — see the schema comment
  }

  WEEKLY_RESET_BOARDS.forEach((board, i) => {
    const live = liveResults[i]
    const liveValue = live.own?.value ?? 0
    const existing = storedByBoard.get(board)
    const weekStartDate = live.weekStartDate!

    if (!existing) {
      if (liveValue > 0) {
        updates.push(
          prisma.leaderboardPersonalBest.create({
            data: { candidateId, board, bestValue: liveValue, weekStartDate },
          })
        )
        result[board] = { bestValue: liveValue, weekStartDate }
      }
      return
    }

    if (liveValue > existing.bestValue) {
      updates.push(
        prisma.leaderboardPersonalBest.update({
          where: { candidateId_board: { candidateId, board } },
          data: { bestValue: liveValue, weekStartDate },
        })
      )
      result[board] = { bestValue: liveValue, weekStartDate }
    } else {
      result[board] = { bestValue: existing.bestValue, weekStartDate: existing.weekStartDate }
    }
  })

  await Promise.all(updates)
  return result as Record<LeaderboardBoard, { bestValue: number; weekStartDate: Date } | null>
}

// Read-only variant for surfaces that just want to display the stored
// record without paying for a live recompute-and-maybe-write (e.g. a
// lightweight one-line mention on the Sprint card) — see SuccessSprintCard.
export async function getStoredPersonalBest(candidateId: string, board: LeaderboardBoard) {
  return prisma.leaderboardPersonalBest.findUnique({ where: { candidateId_board: { candidateId, board } } })
}
