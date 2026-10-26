/** An entry the member added by link and we have not approved yet: theirs to edit until then. Pure, so pages and server code share it. */
export const canEditEntry = (s: { addedBy: string | null; published: boolean; rejectedAt: Date | null }, candidateId: string): boolean =>
  s.addedBy === candidateId && !s.published && !s.rejectedAt
