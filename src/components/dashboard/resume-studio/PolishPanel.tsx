'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'
import type { DocumentSummary } from '@/lib/resume/studio/writing-checks'
import { applySegment } from '@/lib/resume/studio/polish-segments'
import { checkWriting } from '@/app/dashboard/resume/studio/polish-actions'
import type { CheckWritingResult } from '@/app/dashboard/resume/studio/polish-actions'
import type { WritingFix } from '@/lib/resume/studio/polish'

type Run = (draftId: string, document: unknown) => Promise<CheckWritingResult>

// Spelling, grammar and punctuation, one suggestion at a time: the line as it is, the line as it would be, and why.
// Nothing changes until the person accepts it, and a suggestion for a line that has been edited since is refused.
export function PolishPanel({
  draftId,
  doc,
  summary,
  onApply,
  run = checkWriting,
}: {
  draftId: string
  doc: ResumeDocumentData
  summary: DocumentSummary
  onApply: (next: ResumeDocumentData) => void
  run?: Run
}) {
  const [fixes, setFixes] = useState<WritingFix[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [accepted, setAccepted] = useState(0)

  function check() {
    setError(null)
    setStale(null)
    setAccepted(0)
    startTransition(async () => {
      const r = await run(draftId, doc)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setFixes(r.fixes)
    })
  }

  // Applies fixes one after another to a running copy, so accepting several at once cannot overwrite itself.
  function accept(list: WritingFix[]) {
    let next = doc
    const done = new Set<string>()
    let missed = 0
    for (const f of list) {
      const changed = applySegment(next, f.id, f.original, f.replacement)
      if (changed) {
        next = changed
        done.add(f.id)
        posthog.capture('resume_fix_accepted', { draftId, kind: f.kind, source: f.source })
      } else missed++
    }
    if (done.size > 0) onApply(next)
    setAccepted((n) => n + done.size)
    setFixes((cur) => (cur ? cur.filter((f) => !done.has(f.id)) : cur))
    setStale(missed > 0 ? 'A line you changed since the check was left as you wrote it. Check again to see what is left.' : null)
  }

  const dismiss = (f: WritingFix) => {
    posthog.capture('resume_fix_dismissed', { draftId, kind: f.kind, source: f.source })
    setFixes((cur) => (cur ? cur.filter((x) => x.id !== f.id) : cur))
  }

  return (
    <Card>
      <CardContent className={cn('space-y-3 pt-6 text-sm', pending && 'cursor-progress')}>
        <p className="font-medium text-foreground">Polish</p>
        <p className="text-muted-foreground">
          {summary.bulletCount === 0
            ? 'Add bullets to see checks.'
            : `${summary.quantifiedCount} of ${summary.bulletCount} bullets have a number in them. ${summary.notedBullets} ${summary.notedBullets === 1 ? 'has' : 'have'} a suggestion.`}
        </p>
        {summary.rolesWithoutBullets.length > 0 && <p className="text-muted-foreground">No bullets yet for: {summary.rolesWithoutBullets.join('; ')}.</p>}

        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={check}>
          {pending ? 'Checking…' : fixes === null ? 'Check spelling and grammar' : 'Check again'}
        </Button>

        <div role="status" className="space-y-3">
          {fixes !== null && fixes.length === 0 && !error && (
            <p className="text-muted-foreground">{accepted > 0 ? `Done. You accepted ${accepted} ${accepted === 1 ? 'fix' : 'fixes'}. Nothing else needs fixing.` : 'We found no spelling, grammar or punctuation problems.'}</p>
          )}
          {fixes !== null && fixes.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-foreground">{fixes.length === 1 ? '1 suggestion' : `${fixes.length} suggestions`}</p>
                {fixes.length > 1 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => accept(fixes)}>
                    Accept all {fixes.length}
                  </Button>
                )}
              </div>
              <ul className="space-y-4">
                {fixes.map((f) => (
                  <li key={f.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground">Now: </span>
                      {f.original}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground">Fixed: </span>
                      {f.replacement}
                    </p>
                    <p className="text-xs text-muted-foreground">{f.reason}</p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => accept([f])}>
                        Accept
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => dismiss(f)} aria-label={`Keep as written: ${f.label}`}>
                        Keep mine
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {stale && <p className="text-xs text-muted-foreground">{stale}</p>}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Suggestions only. A fix never changes a number, a date or a name, and nothing here stops you saving or downloading.</p>
      </CardContent>
    </Card>
  )
}
