// The firm's own pipeline for an intake candidate. Pure, safe for client components and tests.

export const PIPELINE_STAGES = ['NEW', 'TALKING', 'PRESENTED', 'PLACED', 'NOT_A_FIT'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: 'New',
  TALKING: 'Talking',
  PRESENTED: 'Presented to a client',
  PLACED: 'Placed',
  NOT_A_FIT: 'Not a fit',
}

export const PIPELINE_NOTE_MAX = 2000

export function isPipelineStage(v: string): v is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(v)
}

// Stages where a next step still makes sense.
export const OPEN_STAGES: PipelineStage[] = ['NEW', 'TALKING', 'PRESENTED']

// A next step is due on or before today (date-only compare, UTC).
export function isStepDue(nextStepAt: Date | null, stage: string, now = new Date()): boolean {
  if (!nextStepAt || !(OPEN_STAGES as string[]).includes(stage)) return false
  return nextStepAt.toISOString().slice(0, 10) <= now.toISOString().slice(0, 10)
}

export type PipelineInput = { stage: string; note: string; nextStep: string }
export type PipelineParsed = { stage: PipelineStage; note: string | null; nextStepAt: Date | null }

export function parsePipelineInput(input: PipelineInput): { error: string } | PipelineParsed {
  if (!isPipelineStage(input.stage)) return { error: 'Pick a stage from the list.' }
  const note = input.note.trim()
  if (note.length > PIPELINE_NOTE_MAX) return { error: `Keep the note under ${PIPELINE_NOTE_MAX} characters. Yours is ${note.length}.` }
  let nextStepAt: Date | null = null
  if (input.nextStep.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextStep)) return { error: 'Enter the next step date as a date, for example 2026-12-01.' }
    nextStepAt = new Date(`${input.nextStep}T00:00:00.000Z`)
    if (Number.isNaN(nextStepAt.getTime()) || nextStepAt.toISOString().slice(0, 10) !== input.nextStep) return { error: 'That date does not exist. Pick another.' }
  }
  if (!(OPEN_STAGES as string[]).includes(input.stage)) nextStepAt = null
  return { stage: input.stage, note: note || null, nextStepAt }
}
