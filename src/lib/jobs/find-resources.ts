// "Resources" in the redesign (docs/candidate-redesign.md): job boards with the reason each is here, who can see the
// member's resume, and short guides. Pure and client-safe. Tests: src/test/find-resources.test.ts.

export interface BoardInput {
  name: string
  url: string
  description: string
}

export interface BoardTile extends BoardInput {
  /** Why this board is here: every one says. */
  why: string
}

/**
 * General boards first, then the ones matched to the member's target industries. Each carries the reason it is listed,
 * so a board never appears as a bare name. A board in both lists shows once.
 */
export function labelBoards(general: BoardInput[], industry: BoardInput[]): BoardTile[] {
  const seen = new Set<string>()
  const out: BoardTile[] = []
  for (const b of general) {
    if (seen.has(b.name)) continue
    seen.add(b.name)
    out.push({ ...b, why: 'Open to every industry.' })
  }
  const industryWhy = 'Matches your target industries.'
  for (const b of industry) {
    if (seen.has(b.name)) continue
    seen.add(b.name)
    out.push({ ...b, why: industryWhy })
  }
  return out
}

/** The résumé book line: what is true now, and what choosing the other option does. */
export function resumeBookCopy(optedIn: boolean): { state: string; effect: string } {
  return optedIn
    ? { state: 'Your résumé is in the book.', effect: 'Recruiters and hiring managers browsing by role can find it.' }
    : { state: 'Your résumé is private.', effect: 'Include it and recruiters and hiring managers browsing by role can find it.' }
}

/** The executive-recruiter listing line, only once the member has answered (confirmedAt); null before. */
export function recruiterListingLine(confirmed: boolean, optedIn: boolean): string | null {
  if (!confirmed) return null
  return optedIn ? 'You are listed with executive recruiters.' : 'You are not listed with executive recruiters.'
}
