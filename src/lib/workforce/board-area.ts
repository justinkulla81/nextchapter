/**
 * The counties a board serves: those its service area lists, and for a
 * board drawn by city or town the counties its places are in. A board for a
 * whole state with no local boards under it serves every county.
 */
export function boardCountyKeys(b: { counties: string[]; placeCounties: string[]; statewide: boolean }): string[] | 'all' {
  if (b.statewide) return 'all'
  return [...new Set([...b.counties, ...b.placeCounties.filter((c) => c !== '-')])]
}

/** Boards to show for a state: its local boards, or its state board when it has no local ones. */
export function visibleBoards<B extends { state: string; statewide: boolean }>(boards: B[]): B[] {
  const hasLocal = new Set(boards.filter((b) => !b.statewide).map((b) => b.state))
  return boards.filter((b) => !b.statewide || !hasLocal.has(b.state))
}

export const COLLEGE_SECTORS: Record<number, string> = {
  1: 'Public 4-year', 2: 'Private nonprofit 4-year', 3: 'For-profit 4-year',
  4: 'Public 2-year', 5: 'Private nonprofit 2-year', 6: 'For-profit 2-year',
}
export const COLLEGE_SIZES: Record<number, string> = {
  1: 'Under 1,000', 2: '1,000–4,999', 3: '5,000–9,999', 4: '10,000–19,999', 5: '20,000+',
}
