import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CrucibleJobIntent } from '@prisma/client'

// Same "top N public, computed live from source rows" convention as the
// main app's leaderboard (src/lib/leaderboard/) — no cached running totals,
// no separate reversal step needed if a session is ever removed/corrected.
export const CRUCIBLE_LEADERBOARD_PUBLIC_SIZE = 20

export interface CrucibleLeaderboardEntry {
  rank: number
  displayName: string // "First L." or "Anonymous"
  score: number
  band: string | null
  completedAt: Date
}

// A retry creates a brand-new CrucibleSession row linked via retryOfId, not
// a reuse of the original — so "auto-entered" has to mean one entry per
// PERSON per function, not one per attempt. Walks each session's retry
// chain back to its root so every attempt by the same person collapses
// into one leaderboard row, keeping whichever attempt scored highest.
function findRootId(sessionId: string, retryOfById: Map<string, string | null>): string {
  let current = sessionId
  const seen = new Set<string>()
  while (true) {
    const parent = retryOfById.get(current)
    if (!parent || seen.has(current)) return current
    seen.add(current)
    current = parent
  }
}

export async function getCrucibleLeaderboard(jobIntent: CrucibleJobIntent): Promise<CrucibleLeaderboardEntry[]> {
  const sessions = await prisma.crucibleSession.findMany({
    where: { jobIntent, completedAt: { not: null }, score: { not: null } },
    select: {
      id: true,
      retryOfId: true,
      score: true,
      band: true,
      leaderboardDisplayName: true,
      completedAt: true,
    },
  })

  const retryOfById = new Map(sessions.map((s) => [s.id, s.retryOfId]))
  const bestByRoot = new Map<string, (typeof sessions)[number]>()

  for (const session of sessions) {
    const rootId = findRootId(session.id, retryOfById)
    const existing = bestByRoot.get(rootId)
    if (!existing || (session.score ?? 0) > (existing.score ?? 0)) {
      bestByRoot.set(rootId, session)
    }
  }

  return Array.from(bestByRoot.values())
    .sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0)
      // Ties break by earliest completion — same "first to get there wins
      // the tie" convention as the main app's leaderboard.
      return scoreDiff !== 0 ? scoreDiff : a.completedAt!.getTime() - b.completedAt!.getTime()
    })
    .slice(0, CRUCIBLE_LEADERBOARD_PUBLIC_SIZE)
    .map((session, i) => ({
      rank: i + 1,
      displayName: session.leaderboardDisplayName ?? 'Anonymous',
      score: session.score!,
      band: session.band,
      completedAt: session.completedAt!,
    }))
}
