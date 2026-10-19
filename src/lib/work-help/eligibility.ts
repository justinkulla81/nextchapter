// Who may see and answer a question. Pure, so it can be tested without a database.

export interface QuestionAudience {
  candidateId: string
  seniorityBand: string | null
  excludedCompanies: string[]
}

export interface Viewer {
  id: string
  seniorityBand: string | null
  /** The viewer's current employers, normalized. */
  companies: string[]
}

/**
 * People at the asker's level, at other companies. Never the asker. If we do not know the asker's level, we do not
 * narrow by level. If we do know it, only the same level sees it.
 */
export function canSeeQuestion(viewer: Viewer, q: QuestionAudience): boolean {
  if (viewer.id === q.candidateId) return false
  if (q.seniorityBand && q.seniorityBand !== viewer.seniorityBand) return false
  if (q.excludedCompanies.length > 0 && viewer.companies.some((c) => q.excludedCompanies.includes(c))) return false
  return true
}
