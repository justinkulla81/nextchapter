// How I perform as short rounds. The same forty statements as the long form
// (src/components/dashboard/PerformanceAssessmentForm.tsx), each asked exactly once, scored the same way,
// in rounds of three at most (eight statements per dimension -> 3, 3, 2). Pure: question definitions, round
// order, the payoff, the finish and the conversion to and from the saved answers. performance-rounds.test.ts covers it.

import {
  HOW_I_PERFORM_ITEMS,
  PERFORMANCE_DIMENSION_LABEL,
  PERFORMANCE_DIMENSION_ORDER,
  type PerformanceDimension,
} from '@/lib/constants/how-i-perform-items'
import {
  chunkEvenly,
  pctAnswered,
  roundQuestions,
  totalAnswered,
  isAnswered,
  type FlowDef,
  type RoundAnswers,
  type RoundDef,
  type RoundOption,
  type RoundQuestion,
} from '@/lib/redesign/rounds'

export const AGREEMENT_OPTIONS: RoundOption[] = [
  { value: '1', label: 'Strongly disagree' },
  { value: '2', label: 'Disagree' },
  { value: '3', label: 'Agree' },
  { value: '4', label: 'Strongly agree' },
]

const itemKey = (id: number) => `item-${id}`

export const PERFORMANCE_QUESTIONS: readonly RoundQuestion[] = HOW_I_PERFORM_ITEMS.map((item) => ({
  id: itemKey(item.id),
  kind: 'buttons',
  label: item.text,
  options: AGREEMENT_OPTIONS,
  factLabel: PERFORMANCE_DIMENSION_LABEL[item.dimension],
}))

const DIMENSION_WHY: Record<PerformanceDimension, string> = {
  EXECUTION: 'Whether you deliver what you commit to, on time, is the first thing a hiring manager checks. Your references are asked the same statements.',
  JUDGMENT: 'How you decide when the answer is unclear, and when you escalate, shows employers how far they can trust your calls.',
  COMPOSURE: 'These describe what you did when plans moved or feedback was hard, so an employer can see how you hold up.',
  INFLUENCE: 'Getting results through people who do not report to you is what senior roles are hired for.',
  INTEGRITY: 'How you handle credit, mistakes and promises is the trait references find hardest to fake and employers weigh most.',
}

export const PERFORMANCE_ROUNDS: readonly RoundDef[] = PERFORMANCE_DIMENSION_ORDER.flatMap((dimension) => {
  const items = HOW_I_PERFORM_ITEMS.filter((i) => i.dimension === dimension)
  const chunks = chunkEvenly(items)
  return chunks.map((chunk, i) => ({
    id: `${dimension.toLowerCase()}-${i + 1}`,
    title: chunks.length > 1 ? `${PERFORMANCE_DIMENSION_LABEL[dimension]}, part ${i + 1} of ${chunks.length}` : PERFORMANCE_DIMENSION_LABEL[dimension],
    why: DIMENSION_WHY[dimension],
    feeds: ['Dossier', 'Reference check'],
    questionIds: chunk.map((c) => itemKey(c.id)),
  }))
})

export function dimensionOfRound(round: RoundDef): PerformanceDimension {
  const first = Number(round.questionIds[0].slice('item-'.length))
  return HOW_I_PERFORM_ITEMS.find((i) => i.id === first)!.dimension
}

/** Saved answers (item id -> score 1 to 4) as round answers. */
export function answersFromScores(scores: Record<string, number> | null | undefined): RoundAnswers {
  const a: RoundAnswers = {}
  for (const [id, score] of Object.entries(scores ?? {})) {
    if (Number.isInteger(score) && score >= 1 && score <= 4 && HOW_I_PERFORM_ITEMS.some((i) => i.id === Number(id))) a[itemKey(Number(id))] = [String(score)]
  }
  return a
}

/** Round answers back to item id -> score, the shape the draft and the final response both keep. */
export function scoresFromAnswers(answers: RoundAnswers): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of HOW_I_PERFORM_ITEMS) {
    const v = Number(answers[itemKey(item.id)]?.[0])
    if (Number.isInteger(v) && v >= 1 && v <= 4) out[String(item.id)] = v
  }
  return out
}

export function performanceResponses(answers: RoundAnswers): { itemId: number; score: 1 | 2 | 3 | 4 }[] {
  return Object.entries(scoresFromAnswers(answers)).map(([id, score]) => ({ itemId: Number(id), score: score as 1 | 2 | 3 | 4 }))
}

export function performanceComplete(answers: RoundAnswers): boolean {
  return performanceResponses(answers).length === HOW_I_PERFORM_ITEMS.length
}

function dimensionProgress(answers: RoundAnswers, dimension: PerformanceDimension) {
  const qs = PERFORMANCE_QUESTIONS.filter((q) => q.factLabel === PERFORMANCE_DIMENSION_LABEL[dimension])
  return { done: qs.filter((q) => isAnswered(q, answers)).length, of: qs.length }
}

const minutesLeft = (open: number) => Math.max(1, Math.round((open * 8) / 60))

export function performancePayoff(answers: RoundAnswers, round: RoundDef) {
  const total = totalAnswered(PERFORMANCE_FLOW, answers)
  const n = PERFORMANCE_QUESTIONS.length
  const dimension = dimensionOfRound(round)
  const dim = dimensionProgress(answers, dimension)
  const label = PERFORMANCE_DIMENSION_LABEL[dimension]
  const here = roundQuestions(PERFORMANCE_FLOW, round).filter((q) => isAnswered(q, answers)).length
  const lines = [
    dim.done === dim.of ? `${label} is complete: ${dim.of} of ${dim.of} answered.` : `${label}: ${dim.done} of ${dim.of} answered.`,
    total === n ? 'All forty are answered. Finish to see them added to your dossier.' : `About ${minutesLeft(n - total)} ${minutesLeft(n - total) === 1 ? 'minute' : 'minutes'} left. Your five readings are added to your dossier when all forty are answered.`,
  ]
  return {
    headline: here === 0 ? 'Answer to move your dossier closer.' : `${total} of ${n} statements answered.`,
    lines,
    chips: [...round.feeds],
  }
}

export function performanceFinish(answers: RoundAnswers) {
  const n = PERFORMANCE_QUESTIONS.length
  const total = totalAnswered(PERFORMANCE_FLOW, answers)
  const open = n - total
  const pct = pctAnswered(PERFORMANCE_FLOW, answers)
  if (open > 0) {
    return { headline: `${open} ${open === 1 ? 'statement is' : 'statements are'} left.`, gains: [], open, pct }
  }
  return {
    headline: 'Your five readings are in your dossier.',
    gains: [
      { place: 'Dossier', title: 'Execution, judgment, composure, influence and integrity', detail: 'Hiring managers see them as evidence a résumé cannot give.' },
      { place: 'Reference check', title: 'Your references answer the same statements', detail: 'Where your view and theirs match, trust goes up.' },
    ],
    open,
    pct,
  }
}

export const PERFORMANCE_FLOW: FlowDef = {
  id: 'how_i_perform',
  eventPrefix: 'how_i_perform',
  title: 'How I perform',
  why: 'Hiring managers compare how you see yourself with how your references see you, and the match is what builds trust. Each statement has a stronger end, and honest answers help most.',
  gets: 'Five readings in your dossier (execution, judgment, composure, influence, integrity) that your references can confirm.',
  secondsPerRound: 30,
  questions: PERFORMANCE_QUESTIONS,
  rounds: PERFORMANCE_ROUNDS,
  payoff: performancePayoff,
  finish: performanceFinish,
}
