'use client'

import { useActionState, useState } from 'react'
import type { WorkHistoryEntry } from '@prisma/client'
import { composeBulletAction, saveBulletDraft } from '@/app/dashboard/resume/walkthrough/actions'
import { composeBulletFromAnswers } from '@/lib/walkthrough/compose-bullet'
import type { GuidedBulletAnswers } from '@/lib/walkthrough/types'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { InterviewComfortNote } from './InterviewComfortNote'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

// The one Q&A-compose mechanic with no existing precedent in this codebase
// (§13.1's "guided extraction, not rewriting") — 2-3 short questions unlock
// the bullet, then a plain template joins whatever the candidate actually
// typed (composeBulletFromAnswers, compose-bullet.ts). A blank question is
// omitted from the composed bullet, never filled with a placeholder.
export function GuidedBulletStep({
  entry,
  draft,
  handled,
  nextStep,
}: {
  entry: WorkHistoryEntry
  draft: GuidedBulletAnswers
  handled: boolean
  nextStep: number
}) {
  const [answers, setAnswers] = useState<GuidedBulletAnswers>(draft)
  const [saveState, saveFormAction, savePending] = useActionState(composeBulletAction, undefined)
  const [skipState, skipFormAction, skipPending] = useActionState(composeBulletAction, undefined)
  const pending = savePending || skipPending

  const preview = composeBulletFromAnswers(answers)

  function updateAndAutosave(field: keyof GuidedBulletAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  function autosaveOnBlur() {
    saveBulletDraft(entry.id, answers)
  }

  if (handled) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">
          {entry.roleTitle} · {entry.companyName}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          {entry.keyAchievement ?? 'Skipped — no bullet composed.'}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="size-3.5" aria-hidden /> Saved
        </p>
        <form action={saveFormAction} className={pending ? 'cursor-progress [&_*]:cursor-progress' : ''}>
          <input type="hidden" name="workHistoryEntryId" value={entry.id} />
          <input type="hidden" name="nextStep" value={nextStep} />
          {saveState?.error && <p className="text-sm text-destructive">{saveState.error}</p>}
          <SubmitButton pendingLabel="Loading…">Continue</SubmitButton>
        </form>
      </div>
    )
  }

  return (
    <div className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm font-medium text-foreground">
        {entry.roleTitle} · {entry.companyName}
      </p>
      <p className="text-sm text-muted-foreground">
        This role doesn&apos;t have much detail yet. Answer whichever of these you can — skip any you&apos;re not
        sure about.
      </p>

      <form action={saveFormAction} className="space-y-4">
        <input type="hidden" name="workHistoryEntryId" value={entry.id} />
        <input type="hidden" name="nextStep" value={nextStep} />
        <input type="hidden" name="outcome" value={answers.outcome ?? ''} />
        <input type="hidden" name="scope" value={answers.scope ?? ''} />
        <input type="hidden" name="elaboration" value={answers.elaboration ?? ''} />

        <div className="space-y-2">
          <Label htmlFor="gb-outcome">What was the measurable outcome?</Label>
          <Textarea
            id="gb-outcome"
            value={answers.outcome ?? ''}
            onChange={(e) => updateAndAutosave('outcome', e.target.value)}
            onBlur={autosaveOnBlur}
            rows={2}
            placeholder="e.g. Cut onboarding time from 6 weeks to 2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gb-scope">What was the scope — team size, budget, timeframe?</Label>
          <Textarea
            id="gb-scope"
            value={answers.scope ?? ''}
            onChange={(e) => updateAndAutosave('scope', e.target.value)}
            onBlur={autosaveOnBlur}
            rows={2}
            placeholder="e.g. across a team of 8 over two quarters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gb-elaboration">What would you tell an interviewer if asked to elaborate?</Label>
          <Textarea
            id="gb-elaboration"
            value={answers.elaboration ?? ''}
            onChange={(e) => updateAndAutosave('elaboration', e.target.value)}
            onBlur={autosaveOnBlur}
            rows={2}
            placeholder="e.g. by rebuilding the training curriculum around live shadowing"
          />
        </div>

        {preview && (
          <div className="space-y-1 rounded-md border border-border bg-off-white p-3">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <p className="text-sm text-foreground">{preview}</p>
          </div>
        )}

        <InterviewComfortNote />

        {saveState?.error && <p className="text-sm text-destructive">{saveState.error}</p>}
        <SubmitButton pendingLabel="Saving…">Save this bullet</SubmitButton>
      </form>

      <form action={skipFormAction}>
        <input type="hidden" name="workHistoryEntryId" value={entry.id} />
        <input type="hidden" name="nextStep" value={nextStep} />
        <input type="hidden" name="outcome" value="" />
        <input type="hidden" name="scope" value="" />
        <input type="hidden" name="elaboration" value="" />
        {skipState?.error && <p className="text-sm text-destructive">{skipState.error}</p>}
        <SubmitButton variant="ghost" size="sm" pendingLabel="Loading…">
          Skip this bullet
        </SubmitButton>
      </form>
    </div>
  )
}
