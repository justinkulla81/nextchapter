'use client'

import { useState, useTransition } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  deleteNarrative,
  regenerateCoreStatement,
  regenerateStoryAdaptations,
  renameNarrative,
  updateNarrativeStatement,
} from '@/app/dashboard/portfolio/actions'
import { NewNarrativeForm, type NarrativeItem } from '@/components/dashboard/portfolio/NarrativeManager'
import { WaysToSayIt } from '@/components/dashboard/marketing-plan/WaysToSayIt'

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

function AlternativeNarrativeTabContent({
  narrative,
  linkedin,
}: {
  narrative: NarrativeItem
  linkedin?: { configured: boolean; connected: boolean }
}) {
  const [isPending, startTransition] = useTransition()
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
      // Two separate Server Action calls — see the comment on
      // regenerateCoreStatement for why these can't be one invocation.
      await regenerateCoreStatement(narrative.id)
      await regenerateStoryAdaptations(narrative.id)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteNarrative(narrative.id)
    })
  }

  return (
    <div className={cn('space-y-6', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {renaming ? (
              <div className="flex items-center gap-2">
                <input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
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
              narrative.label
            )}
          </CardTitle>
          {!renaming && (
            <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(true)}>
              Rename
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editingStatement ? (
            <div className="space-y-2">
              <Textarea value={statementDraft} onChange={(e) => setStatementDraft(e.target.value)} rows={4} />
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
        </CardContent>
      </Card>

      {narrative.adaptations && <WaysToSayIt adaptations={narrative.adaptations} linkedin={linkedin} />}

      <div className="border-t border-border pt-3">
        {confirmingDelete ? (
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
  )
}

export function AlternativeNarrativeTabs({
  alternatives,
  initialLabel,
  initialScenario,
  linkedin,
}: {
  alternatives: NarrativeItem[]
  initialLabel?: string
  initialScenario?: string
  linkedin?: { configured: boolean; connected: boolean }
}) {
  return (
    <div className="space-y-4">
      {alternatives.length > 0 && (
        <Tabs defaultValue={alternatives[0].id}>
          <div className="overflow-x-auto">
            <TabsList className="h-auto min-w-full justify-start gap-1 bg-light-gray p-1">
              {alternatives.map((n) => (
                <TabsTrigger key={n.id} value={n.id} className="shrink-0 px-3 py-2">
                  {n.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {alternatives.map((n) => (
            <TabsContent key={n.id} value={n.id} className="mt-6">
              <AlternativeNarrativeTabContent narrative={n} linkedin={linkedin} />
            </TabsContent>
          ))}
        </Tabs>
      )}
      <NewNarrativeForm onCreated={() => {}} initialLabel={initialLabel} initialScenario={initialScenario} />
    </div>
  )
}
