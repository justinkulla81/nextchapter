// States that share a commuting metro with a neighbour (New York/Hoboken,
// Washington/Arlington, Philadelphia/Camden, Boston/Nashua) — a job across
// that line is local, not a move. Used by fit scoring (job-fit-bucket.ts) and
// the board search's metro locations (board-search.ts).
export const SHARED_METRO_STATES: Record<string, string[]> = {
  NY: ['NJ', 'CT'],
  NJ: ['NY', 'PA'],
  CT: ['NY'],
  PA: ['NJ', 'DE'],
  DE: ['PA'],
  DC: ['MD', 'VA'],
  MD: ['DC', 'VA'],
  VA: ['DC', 'MD'],
  MA: ['NH', 'RI'],
  NH: ['MA'],
  RI: ['MA'],
}
