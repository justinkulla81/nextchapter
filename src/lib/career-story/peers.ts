// "People like you": where others in the same function have put their attention, as a count of
// people, never a promise. Pure and client-safe. A group smaller than MIN_CELL is not shown at
// all, and counts under 50 are rounded to the nearest 5 so no one can be picked out.

export const MIN_CELL = 10

export type PeerCount = { function: string; people: number }
export type PeerRow = { function: string; people: number; approx: boolean }
export type PeerView = { enough: boolean; total: number; rows: PeerRow[] }

export function roundPeers(n: number): number {
  return n < 50 ? Math.round(n / 5) * 5 : n
}

export function peerView(totalInFunction: number, counts: PeerCount[], limit = 4): PeerView {
  if (totalInFunction < MIN_CELL * 3) return { enough: false, total: 0, rows: [] }
  const rows = counts
    .filter((c) => c.people >= MIN_CELL)
    .sort((a, b) => b.people - a.people)
    .slice(0, limit)
    .map((c) => ({ function: c.function, people: roundPeers(c.people), approx: c.people < 50 }))
  return { enough: rows.length > 0, total: roundPeers(totalInFunction), rows }
}
