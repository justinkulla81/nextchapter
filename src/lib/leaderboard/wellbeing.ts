import { LEADERBOARD_OWN_RANK_VISIBLE_THRESHOLD, LEADERBOARD_PUBLIC_SIZE } from '@/lib/leaderboard/boards'

// §18 — "Never show a discouraging rank." No 'server-only' here: this is
// pure display logic, safe (and needed) in client components too.
//
// - Inside the top 10: the candidate already sees themselves in `top10`,
//   nothing extra to say.
// - Rank 11-25: a real number is fine to show.
// - Below 25, or not publicly participating at all: progress framing only —
//   "N points from the top 10," never a raw rank. `pointsFromTop10` is the
//   gap to the LOWEST value currently in the top 10 (the 10th-place value),
//   the real bar to clear.
export type OwnPositionMessage =
  | { kind: 'in_top_10' }
  | { kind: 'ranked'; rank: number }
  | { kind: 'progress'; pointsBehind: number }
  | { kind: 'not_participating' }

export function describeOwnPosition(params: {
  own: { rank: number; value: number; optedIn: boolean } | null
  tenthPlaceValue: number | null // top10[9]?.value, or null if fewer than 10 ranked entries exist
}): OwnPositionMessage {
  const { own, tenthPlaceValue } = params
  if (!own) return { kind: 'not_participating' }
  if (own.rank <= LEADERBOARD_PUBLIC_SIZE) return { kind: 'in_top_10' }
  if (own.rank <= LEADERBOARD_OWN_RANK_VISIBLE_THRESHOLD) return { kind: 'ranked', rank: own.rank }
  const gap = tenthPlaceValue !== null ? Math.max(0, tenthPlaceValue - own.value) : 0
  return { kind: 'progress', pointsBehind: gap }
}

export function formatOwnPosition(message: OwnPositionMessage, unit: string): string {
  switch (message.kind) {
    case 'in_top_10':
      return "You're in the top 10 this week."
    case 'ranked':
      return `You're #${message.rank} this week.`
    case 'progress':
      return message.pointsBehind > 0
        ? `You're ${message.pointsBehind} ${unit} from the top 10 this week.`
        : "Keep going — you're close to the top 10 this week."
    case 'not_participating':
      return "You're not on this board yet — opt in from Privacy settings to see where you'd rank."
  }
}
