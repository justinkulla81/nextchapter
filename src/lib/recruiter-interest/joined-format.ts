export interface JoinedPick { id: string; candidateId: string; firmOrgId: string }

/** One member's picks together, so they get a single email for every firm that joined. */
export function groupPicksByMember(picks: JoinedPick[]): Map<string, JoinedPick[]> {
  const by = new Map<string, JoinedPick[]>()
  for (const p of picks) by.set(p.candidateId, [...(by.get(p.candidateId) ?? []), p])
  return by
}

/** The subject line. A member in confidential search mode gets a generic one, so a shared screen shows nothing about a search. */
export function joinedSubject(firms: string[], confidential: boolean): string {
  if (confidential) return 'An update from NextChapter'
  return firms.length === 1 ? `${firms[0]} has joined NextChapter` : `${firms.length} firms you picked have joined NextChapter`
}
