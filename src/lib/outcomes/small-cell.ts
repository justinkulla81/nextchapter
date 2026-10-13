// Aggregate views for schools and employers must never expose individuals.
// Any cell with fewer than MIN_CELL_SIZE people is suppressed (returns null).
export const MIN_CELL_SIZE = 10

export function suppressSmallCell<T>(n: number, value: T): T | null {
  return Number.isFinite(n) && n >= MIN_CELL_SIZE ? value : null
}
