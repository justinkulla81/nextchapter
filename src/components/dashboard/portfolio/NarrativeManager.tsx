'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  createNarrative,
  deleteNarrative,
  regenerateNarrative,
  renameNarrative,
  updateNarrativeStatement,
} from '@/app/dashboard/portfolio/actions'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

export interface NarrativeItem {
  id: string
  label: string
  coreStatement: string
  adaptations: NarrativeAdaptations | null
  isDefault: boolean
}

const ADAPTATION_LABELS: Record<keyof NarrativeAdaptations, string> = {
  linkedinHeadline: 'LinkedIn Headline',
  linkedinAbout: 'LinkedIn About',
  resumeSummary: 'Resume Summary',
  emailOpening: 'Email Opening',
  verbal30s: '30-Second Verbal',
  tellMeAboutYourself: '"Tell Me About Yourself"',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function NarrativeRow({ narrative }: { narrative: NarrativeItem }) {
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [labelDraft, setLabelDraft] = useState(narrative.label)
  const [editingStatement, setEditingStatement] = useState(false)
  const [statementDraft, setStatementDraft] = useState(narrative.coreStatement)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleRename = () => {
    const trimmed = labelDraft.trim()
    if (!trimmed) return
    startTransition(async () => {
      await renameNarrative(narrative.id, trimmed)
      setRenaming(false)
    })
  }

  const handleSaveStatement = () => {
    startTransition(async () => {
      await updateNarrativeStatement(narrative.id, statementDraft)
      setEditingStatement(false)
    })
  }

  const handleRegenerate = () => {
    startTransition(async () => {
      await regenerateNarrative(narrative.id)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteNarrative(narrative.id)
    })
  }

  return (
    <Card className={cn(isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  className="h-8 max-w-xs"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={handleRename} disabled={isPending}>
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLabelDraft(narrative.label)
                    setRenaming(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-left text-sm font-semibold text-foreground hover:underline"
                >
                  {narrative.label}
                </button>
                {narrative.isDefault && (
                  <span className="rounded-full bg-off-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Default
                  </span>
                )}
              </div>
            )}
            {!expanded && !renaming && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{narrative.coreStatement}</p>
            )}
          </div>
          {!renaming && (
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Collapse' : 'View'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(true)}>
                Rename
              </Button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="space-y-4 border-t border-border pt-4">
            {editingStatement ? (
              <div className="space-y-2">
                <Textarea
                  value={statementDraft}
                  onChange={(e) => setStatementDraft(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleSaveStatement} disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save & regenerate adaptations'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setStatementDraft(narrative.coreStatement)
                      setEditingStatement(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-foreground">{narrative.coreStatement}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingStatement(true)}>
                    Edit
                  </Button>
                  <CopyButton text={narrative.coreStatement} />
                  <Button type="button" size="sm" variant="outline" onClick={handleRegenerate} disabled={isPending}>
                    {isPending ? 'Regenerating…' : 'Regenerate'}
                  </Button>
                </div>
              </div>
            )}

            {narrative.adaptations && (
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Six ways to say it
                </p>
                {(Object.keys(ADAPTATION_LABELS) as (keyof NarrativeAdaptations)[]).map((key) => (
                  <div key={key} className="rounded-md border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">{ADAPTATION_LABELS[key]}</p>
                    <p className="mt-1 mb-2 text-sm whitespace-pre-line text-foreground">
                      {narrative.adaptations![key]}
                    </p>
                    <CopyButton text={narrative.adaptations![key]} />
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border pt-3">
              {narrative.isDefault ? (
                <p className="text-xs text-muted-foreground">
                  This is your default narrative — it&apos;s the one used across Interview Prep and other
                  parts of the app, so it can&apos;t be deleted. Edit or regenerate it instead.
                </p>
              ) : confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground">Delete &ldquo;{narrative.label}&rdquo; for good?</p>
                  <Button type="button" size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
                    {isPending ? 'Deleting…' : 'Delete'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingDelete(true)}>
                  Delete this narrative
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function NewNarrativeForm({ onCreated }: { onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [scenario, setScenario] = useState('')
  const [error, setError] = useState(false)

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        + Add a narrative for a different scenario
      </Button>
    )
  }

  const handleCreate = () => {
    if (!scenario.trim()) return
    setError(false)
    startTransition(async () => {
      const result = await createNarrative(label, scenario)
      if (!result) {
        setError(true)
        return
      }
      setLabel('')
      setScenario('')
      setOpen(false)
      onCreated()
    })
  }

  return (
    <Card className={cn(isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <CardContent className="space-y-3 pt-6">
        <div>
          <label className="text-sm font-medium text-foreground">Name this narrative</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Why I'm leaving finance for product"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">What&apos;s the scenario?</label>
          <Textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Describe the situation this version of your story needs to explain — e.g. a layoff, a pivot, a return after time off."
            rows={3}
            className="mt-1"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">
            Something went wrong drafting this narrative. Your text above is still here — try again.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" onClick={handleCreate} disabled={isPending || !scenario.trim()}>
            {isPending ? 'Drafting…' : 'Draft this narrative'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false)
              setLabel('')
              setScenario('')
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function NarrativeManager({ narratives }: { narratives: NarrativeItem[] }) {
  return (
    <div className="space-y-3">
      {narratives.map((n) => (
        <NarrativeRow key={n.id} narrative={n} />
      ))}
      <NewNarrativeForm onCreated={() => {}} />
    </div>
  )
}
