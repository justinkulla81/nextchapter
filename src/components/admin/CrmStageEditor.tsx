'use client'

import { useState, useTransition } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  renameStage, moveStage, addStage, deleteStage, setStageOutcome,
} from '@/app/support/admin/(portal)/crm/actions'

export interface StageRow {
  id: string
  label: string
  sortOrder: number
  isWon: boolean
  isLost: boolean
  dealCount: number
}

/**
 * Editing the stages a deal moves through.
 *
 * The nine seeded stages are a starting point, not a rule — "Committed" means
 * a term sheet in fundraising and a signed contract in outplacement, and a
 * pipeline you cannot rename is one you end up working around.
 */
export function CrmStageEditor({
  pipelineId, pipelineLabel, stages,
}: {
  pipelineId: string
  pipelineLabel: string
  stages: StageRow[]
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const add = addStage.bind(null, pipelineId)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand"
      >
        Edit stages
      </button>
    )
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Stages of a deal — {pipelineLabel}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground underline">
          Done
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Rename, reorder, add or remove. A stage holding deals cannot be removed until they are moved —
        deleting it would either orphan them or move them somewhere you did not choose.
      </p>

      <ul className="mt-3 space-y-2">
        {stages.map((s, i) => (
          <StageRowEditor
            key={s.id}
            stage={s}
            isFirst={i === 0}
            isLast={i === stages.length - 1}
            onError={setError}
          />
        ))}
      </ul>

      {error && <p role="status" className="mt-2 text-sm text-destructive">{error}</p>}

      <form action={add} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <label className="text-xs">
          <span className="mb-1 block font-medium">Add a stage</span>
          <input
            name="label" required placeholder="Diligence"
            className="h-8 w-52 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <SubmitButton size="sm" pendingLabel="Adding…">Add stage</SubmitButton>
        <span className="text-xs text-muted-foreground">Goes in before Won and Lost, where new work belongs.</span>
      </form>
    </section>
  )
}

function StageRowEditor({
  stage, isFirst, isLast, onError,
}: {
  stage: StageRow
  isFirst: boolean
  isLast: boolean
  onError: (m: string | null) => void
}) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const rename = renameStage.bind(null, stage.id)

  const outcome = stage.isWon ? 'won' : stage.isLost ? 'lost' : 'open'

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
      <form action={rename} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`label-${stage.id}`}>Stage name</label>
        <input
          id={`label-${stage.id}`}
          name="label"
          defaultValue={stage.label}
          className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
        <SubmitButton size="sm" variant="outline" pendingLabel="Saving…" savedLabel="Saved">Rename</SubmitButton>
      </form>

      <span className="text-xs text-muted-foreground">
        {stage.dealCount} {stage.dealCount === 1 ? 'deal' : 'deals'}
      </span>

      <select
        aria-label={`What ${stage.label} means`}
        defaultValue={outcome}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as 'won' | 'lost' | 'open'
          start(() => { void setStageOutcome(stage.id, next) })
        }}
        className="h-7 rounded border border-input bg-transparent px-1.5 text-xs"
      >
        <option value="open">In progress</option>
        <option value="won">Counts as won</option>
        <option value="lost">Counts as lost</option>
      </select>

      <span className="ml-auto flex items-center gap-1">
        <button
          type="button"
          disabled={isFirst || pending}
          onClick={() => start(() => { void moveStage(stage.id, 'up') })}
          aria-label={`Move ${stage.label} earlier`}
          className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-muted"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={isLast || pending}
          onClick={() => start(() => { void moveStage(stage.id, 'down') })}
          aria-label={`Move ${stage.label} later`}
          className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-muted"
        >
          ↓
        </button>

        {/* Destructive, so it takes a second step and is never default focus. */}
        {!confirming ? (
          <button
            type="button"
            onClick={() => { setConfirming(true); onError(null) }}
            className="rounded border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            Remove
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                const r = await deleteStage(stage.id)
                if (!r.ok) onError(r.message)
                setConfirming(false)
              })}
              className="rounded bg-destructive px-2 py-1 text-xs font-medium text-white"
            >
              {pending ? 'Removing…' : 'Confirm'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded border border-border px-2 py-1 text-xs">
              Cancel
            </button>
          </>
        )}
      </span>
    </li>
  )
}
