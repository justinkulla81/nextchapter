// Which record of a duplicate group is the best one to keep.
//
// The record with the most going on wins, since merging moves everything else onto
// it and the busiest record is the one least worth disturbing. On a tie, one linked
// to a company record beats one that is not, and after that the oldest wins (the
// first one anyone created is the one other records were built around).

export interface KeeperCandidate {
  id: string
  /** People, deals and mandates for an organization; postings for a company. */
  activity: number
  linked: boolean
  createdAt: Date
}

export type KeeperBasis = 'activity' | 'linked' | 'oldest'

export function suggestKeeper(members: KeeperCandidate[]): { id: string; basis: KeeperBasis } {
  const ranked = [...members].sort(
    (a, b) =>
      b.activity - a.activity ||
      Number(b.linked) - Number(a.linked) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  )
  const [first, second] = ranked
  if (!second || first.activity > second.activity) return { id: first.id, basis: 'activity' }
  if (first.linked !== second.linked) return { id: first.id, basis: 'linked' }
  return { id: first.id, basis: 'oldest' }
}
