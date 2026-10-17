'use client'

import { useActionState } from 'react'
import { saveCushion, type StoryFormState } from '@/app/dashboard/my-career/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAUSE_CHECKLIST, PAUSE_CHOICES, pauseSummary } from '@/lib/career-story/pause'
import { cn } from '@/lib/utils'

// "What if I took a pause?" Uses only the number the member gives. Nothing is saved about the
// pause itself, and nothing here says how hiring would respond.
export function PauseTool({ cushionMonths, months, onMonths }: { cushionMonths: number | null; months: number; onMonths: (m: number) => void }) {
  const [state, action] = useActionState<StoryFormState, FormData>(saveCushion, undefined)
  const summary = pauseSummary(cushionMonths, months)
  return (
    <section id="pause-tool" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="pause-heading">
      <div className="space-y-1">
        <h2 id="pause-heading" className="text-lg font-semibold tracking-tight">
          What if you took a pause?
        </h2>
        <p className="text-sm text-muted-foreground">Try it on. Nothing here is saved to your story, and it does not change your search.</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium" id="pause-length-label">
          How long?
        </p>
        <div role="group" aria-labelledby="pause-length-label" className="flex flex-wrap gap-2">
          {PAUSE_CHOICES.map((m) => (
            <Button key={m} type="button" variant="outline" aria-pressed={months === m} onClick={() => onMonths(months === m ? 0 : m)} className={cn(months === m && 'border-light-blue bg-light-blue/10')}>
              {m} months
            </Button>
          ))}
        </div>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="cushion-months">Months of expenses you have saved</Label>
          <Input id="cushion-months" name="months" type="number" min={0} max={60} step={0.5} inputMode="decimal" defaultValue={cushionMonths ?? ''} className="w-40" />
        </div>
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save this number
        </SubmitButton>
        <p className="w-full text-xs text-muted-foreground">Only you can see this. A rough number is fine.</p>
        {state?.error && (
          <p role="alert" className="w-full text-sm text-error">
            {state.error}
          </p>
        )}
      </form>
      <div className="space-y-2 rounded-xl bg-muted/50 p-4" aria-live="polite">
        <p className="text-sm font-semibold text-foreground">{summary.headline}</p>
        <p className="text-sm text-muted-foreground">{summary.detail}</p>
        {summary.known && months > 0 && (
          <div className="h-2 overflow-hidden rounded-full bg-border" role="img" aria-label={`Your cushion covers ${Math.round(summary.barPct)} percent of a ${months}-month pause`}>
            <div className="h-full rounded-full bg-light-blue" style={{ width: `${summary.barPct}%` }} />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Worth checking before any pause</h3>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {PAUSE_CHECKLIST.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
