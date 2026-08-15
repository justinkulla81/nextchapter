import 'server-only'
import { getCompetencyGaps, competenciesNeedingEvidence } from '@/lib/hiring/competency-gaps'

// §A8 — "reference questions worth asking, given what's already known" —
// deliberately distinct from generate-interview-guide.ts's item 2
// (questions for the CANDIDATE). Built rule-based rather than
// LLM-generated: the underlying signal (which competency has thin/no
// reference corroboration) is already a clean, small, structured set from
// competency-gaps.ts, and turning "Ownership has no reference evidence
// yet" into "ask a reference about a time they had to trust this person
// without checking in" is templated phrasing, not a task that benefits
// from generation — a fixed template per competency is exactly as good and
// costs nothing per view.
export interface ReferenceQuestion {
  competency: string
  label: string
  question: string
  rationale: string
}

const QUESTION_TEMPLATE: Record<string, string> = {
  leadership: 'Tell me about a time you saw this person lead a team or a cross-functional effort. What did that actually look like day to day?',
  skillsExecution: "Can you give a specific example of this person seeing something through to completion, including when it got harder than expected?",
  communication: 'How does this person communicate when something is going wrong, not just when things are on track?',
  adaptability: 'Describe a time this person had to change direction or handle real ambiguity. How did they handle it?',
  ownership: "Tell me about a time you handed this person something and didn't have to check in. What made that work?",
}

export async function getReferenceQuestions(candidateId: string): Promise<ReferenceQuestion[]> {
  const gaps = await getCompetencyGaps(candidateId)
  const needsEvidence = competenciesNeedingEvidence(gaps)

  return needsEvidence
    .filter((gap) => gap.referenceThin) // only the ones a REFERENCE call can actually help with
    .map((gap) => ({
      competency: gap.competency,
      label: gap.label,
      question: QUESTION_TEMPLATE[gap.competency],
      rationale: gap.narrativeGapText
        ? `No completed reference speaks to ${gap.label} yet, and it's a named gap in this candidate's profile.`
        : `No completed reference speaks to ${gap.label} yet — worth asking directly.`,
    }))
    .slice(0, 5)
}
