import 'server-only'

export interface EffortSummaryInputs {
  learningCount: number
  applicationsCount: number
  outreachCount: number
}

// Shared by the candidate-facing Certified Executive Dossier and the employer-facing
// Evidence Brief — one implementation so the two never drift out of sync.
// Deliberately template-based, not LLM-generated: every line is a real,
// countable fact, so there's no hallucination risk in a document read as an
// attestation of effort.
export function computeEffortSummaryLines({
  learningCount,
  applicationsCount,
  outreachCount,
}: EffortSummaryInputs): string[] {
  const lines: string[] = []
  if (learningCount > 0) {
    lines.push(`Completed ${learningCount} learning action${learningCount === 1 ? '' : 's'} to close identified gaps.`)
  }
  if (applicationsCount > 0) {
    lines.push(`Submitted ${applicationsCount} tailored application${applicationsCount === 1 ? '' : 's'}.`)
  }
  if (outreachCount > 0) {
    lines.push(`Initiated ${outreachCount} outreach conversation${outreachCount === 1 ? '' : 's'} this search.`)
  }
  return lines
}
