import { SESSION_DIMENSION_LABEL, type SessionDimensionKey } from './session-dimensions'

// §A5.1 "drives intervention suggestions" / §A5.2 "intervention library
// keyed to trigger." A minimal real library, not a stub: one concrete,
// actionable suggestion per dimension, written as something a coach could
// actually do in the next session. Keyed by dimension rather than by a
// separate trigger-type taxonomy — the dimension itself IS the trigger here,
// per §A5.1's own rule ("2+ dimensions at-risk/declining").
export interface Intervention {
  dimension: SessionDimensionKey
  label: string
  suggestion: string
}

const INTERVENTION_SUGGESTION: Record<SessionDimensionKey, string> = {
  targeting:
    'Revisit target role/level together before assigning more applications — a scattershot pattern usually means the target itself needs narrowing, not more volume.',
  motivation:
    'Open the next session by naming the dip directly and asking what would make one specific day easier this week — a small, concrete win rebuilds momentum faster than a pep talk.',
  networking:
    'Co-write 2-3 outreach messages live in session — a stalled reply rate is often a message-quality problem, fixable in the room, not a volume problem.',
  applicationVolume:
    'Check the channel mix before pushing more volume — low conversion at high volume usually means the wrong channel for this level, not not-enough-effort.',
  skills:
    'Name the specific gap out loud and agree one concrete, time-boxed way to close it before the next session — vague "brush up on X" rarely moves.',
  narrative:
    'Run a 10-minute live pitch drill this session — narrative gaps are usually clearer once heard out loud than described on paper.',
  interviewPractice:
    'Identify the exact stage they lose at and run a targeted mock for that stage only — broad "interview prep" wastes time once the failure point is known.',
}

// Suggestions for whichever dimensions came back "concerning" (see
// isDimensionConcerning) on a candidate's latest session — in canonical
// §A5.1 order, matching how the dimensions render everywhere else.
export function getInterventionSuggestions(concerningDimensions: SessionDimensionKey[]): Intervention[] {
  return concerningDimensions.map((dimension) => ({
    dimension,
    label: SESSION_DIMENSION_LABEL[dimension],
    suggestion: INTERVENTION_SUGGESTION[dimension],
  }))
}
