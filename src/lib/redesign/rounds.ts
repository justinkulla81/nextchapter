// Short rounds for the long questionnaires (docs/candidate-redesign.md, "Every question flow"): at most three
// questions at a time, why we ask first, a payoff that updates as answers come in, a finish screen, and one
// optional next question. This file is the shared, pure part: the types, the splitting, the answer merging
// and the checks that keep every original question asked exactly once. rounds.test.ts covers it.

export const MAX_QUESTIONS_PER_ROUND = 3

export interface RoundOption {
  value: string
  label: string
}

/** buttons: 2 to 4 options side by side. select: 5 or more, one choice. multi: pick any. rank: pick in order. text: free text. */
export type RoundQuestionKind = 'buttons' | 'select' | 'multi' | 'rank' | 'text'

export interface RoundQuestion {
  id: string
  label: string
  help?: string
  kind: RoundQuestionKind
  options?: readonly RoundOption[]
  /** The most picks for multi and rank. */
  max?: number
  /** A multi-select value that stands alone ("None of these"): picking it clears the others, and picking another clears it. */
  exclusive?: string
  placeholder?: string
  maxLength?: number
  /** Short noun for the payoff line: "Largest team managed". */
  factLabel: string
}

/** Every answer is a list of strings: one value for a single choice, the picks in order for multi and rank, the text for text. */
export type RoundAnswers = Record<string, string[]>

export interface RoundDef {
  id: string
  title: string
  /** "Why we ask", shown first. */
  why: string
  /** The places this round changes, as chips. */
  feeds: string[]
  questionIds: string[]
}

export interface RoundPayoff {
  headline: string
  lines: string[]
  chips: string[]
}

export interface FinishGain {
  place: string
  title: string
  detail: string
}

export interface RoundsFinish {
  headline: string
  gains: FinishGain[]
  /** Questions still open, so the screen can say so plainly. */
  open: number
  /** Whole-flow completion, 0 to 100. */
  pct: number
}

/** What a flow's server action takes and gives back. `allAnswers` is the browser's full set, a safety net if a draft cannot be read. */
export interface RoundSaveInput {
  roundId: string
  answers: RoundAnswers
  allAnswers?: RoundAnswers
  final: boolean
}
export type RoundSaveResult = { ok: true; answers: RoundAnswers; completed: boolean } | { ok: false; error: string }

export interface FlowDef {
  id: 'track_record' | 'how_i_perform'
  /** Prefix of every PostHog event: track_record_round_completed, how_i_perform_finished, ... */
  eventPrefix: string
  title: string
  /** The page-level reason, one or two sentences. */
  why: string
  /** What the whole flow gets the member, for the intro. */
  gets: string
  /** About how long one round takes, in seconds. */
  secondsPerRound: number
  questions: readonly RoundQuestion[]
  rounds: readonly RoundDef[]
  payoff: (answers: RoundAnswers, round: RoundDef) => RoundPayoff
  finish: (answers: RoundAnswers) => RoundsFinish
}

/** Splits n things into the fewest rounds of at most `max`, as even as possible: 8 -> 3, 3, 2. */
export function evenChunkSizes(n: number, max = MAX_QUESTIONS_PER_ROUND): number[] {
  if (n <= 0) return []
  const rounds = Math.ceil(n / max)
  const base = Math.floor(n / rounds)
  const extra = n % rounds
  return Array.from({ length: rounds }, (_, i) => base + (i < extra ? 1 : 0))
}

export function chunkEvenly<T>(items: readonly T[], max = MAX_QUESTIONS_PER_ROUND): T[][] {
  const out: T[][] = []
  let at = 0
  for (const size of evenChunkSizes(items.length, max)) {
    out.push(items.slice(at, at + size))
    at += size
  }
  return out
}

export function questionOf(flow: FlowDef, id: string): RoundQuestion | undefined {
  return flow.questions.find((q) => q.id === id)
}

export function roundQuestions(flow: FlowDef, round: RoundDef): RoundQuestion[] {
  return round.questionIds.map((id) => questionOf(flow, id)).filter((q): q is RoundQuestion => !!q)
}

export function isAnswered(q: RoundQuestion, answers: RoundAnswers): boolean {
  return (answers[q.id] ?? []).some((v) => v.trim() !== '')
}

export function answeredIn(flow: FlowDef, round: RoundDef, answers: RoundAnswers): { answered: number; skipped: number } {
  const qs = roundQuestions(flow, round)
  const answered = qs.filter((q) => isAnswered(q, answers)).length
  return { answered, skipped: qs.length - answered }
}

export function totalAnswered(flow: FlowDef, answers: RoundAnswers): number {
  return flow.questions.filter((q) => isAnswered(q, answers)).length
}

/** The round to resume at: the first with a question still open, or -1 when every question has an answer. */
export function firstOpenRound(flow: FlowDef, answers: RoundAnswers): number {
  return flow.rounds.findIndex((r) => answeredIn(flow, r, answers).skipped > 0)
}

export function roundDone(flow: FlowDef, round: RoundDef, answers: RoundAnswers): boolean {
  return answeredIn(flow, round, answers).skipped === 0
}

export function pctAnswered(flow: FlowDef, answers: RoundAnswers): number {
  return flow.questions.length === 0 ? 0 : Math.round((totalAnswered(flow, answers) / flow.questions.length) * 100)
}

/**
 * Non-destructive merge of a round's answers into what is already saved. Only questions the round owns can change;
 * a blank answer never erases a saved one (a skipped question keeps what it had); every other round is untouched.
 */
export function mergeAnswers(saved: RoundAnswers, incoming: RoundAnswers, allowedIds?: readonly string[]): RoundAnswers {
  const merged: RoundAnswers = { ...saved }
  for (const [id, value] of Object.entries(incoming)) {
    if (allowedIds && !allowedIds.includes(id)) continue
    const clean = value.map((v) => v.trim()).filter(Boolean)
    if (clean.length === 0) continue
    merged[id] = clean
  }
  return merged
}

/**
 * What a server action may trust from the browser: only the round's own questions, only listed option values,
 * no duplicates, no more picks than the question allows, text trimmed and capped. Anything else is dropped.
 */
export function sanitizeRoundAnswers(flow: FlowDef, round: RoundDef, raw: unknown): RoundAnswers {
  const out: RoundAnswers = {}
  if (!raw || typeof raw !== 'object') return out
  for (const q of roundQuestions(flow, round)) {
    const v = (raw as Record<string, unknown>)[q.id]
    if (!Array.isArray(v)) continue
    const strings = v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    if (q.kind === 'text') {
      const text = (strings[0] ?? '').slice(0, q.maxLength ?? 500)
      if (text) out[q.id] = [text]
      continue
    }
    const allowed = new Set((q.options ?? []).map((o) => o.value))
    const picks = [...new Set(strings)].filter((x) => allowed.has(x))
    const limit = q.kind === 'buttons' || q.kind === 'select' ? 1 : (q.max ?? picks.length)
    const kept = picks.slice(0, limit)
    if (kept.length > 0) out[q.id] = kept
  }
  return out
}

/** The same check across every round, for a browser's full set of answers. */
export function sanitizeAllAnswers(flow: FlowDef, raw: unknown): RoundAnswers {
  return flow.rounds.reduce<RoundAnswers>((all, round) => ({ ...all, ...sanitizeRoundAnswers(flow, round, raw) }), {})
}

export function optionLabels(q: RoundQuestion, answers: RoundAnswers): string[] {
  const values = answers[q.id] ?? []
  if (q.kind === 'text') return values
  const byValue = new Map((q.options ?? []).map((o) => [o.value, o.label]))
  return values.map((v) => byValue.get(v) ?? v)
}

/** "A", "A and B", "A, B and C". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Problems that would break the promises of the flow. An empty list is a flow that is safe to ship. */
export function validateFlow(flow: FlowDef): string[] {
  const problems: string[] = []
  const seen = new Map<string, number>()
  const ids = new Set(flow.questions.map((q) => q.id))
  if (ids.size !== flow.questions.length) problems.push('duplicate question ids')
  for (const round of flow.rounds) {
    if (round.questionIds.length === 0) problems.push(`round ${round.id} is empty`)
    if (round.questionIds.length > MAX_QUESTIONS_PER_ROUND) problems.push(`round ${round.id} has ${round.questionIds.length} questions`)
    for (const id of round.questionIds) {
      if (!ids.has(id)) problems.push(`round ${round.id} asks unknown question ${id}`)
      seen.set(id, (seen.get(id) ?? 0) + 1)
    }
  }
  for (const q of flow.questions) {
    const n = seen.get(q.id) ?? 0
    if (n !== 1) problems.push(`question ${q.id} is asked ${n} times`)
    const count = q.options?.length ?? 0
    if (q.kind === 'buttons' && (count < 2 || count > 4)) problems.push(`question ${q.id} has ${count} options as buttons`)
    if (q.kind === 'select' && count < 5) problems.push(`question ${q.id} has ${count} options as a dropdown`)
  }
  return problems
}
