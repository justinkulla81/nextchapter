'use client'

import { useActionState, useState } from 'react'
import { cn } from '@/lib/utils'
import { SubmitButton } from '@/components/ui/submit-button'

type State = { error?: string } | null

function Choice({ name, label, help, value, onChange }: { name: string; label: string; help: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-border bg-card p-4">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <p className="text-sm text-muted-foreground">{help}</p>
      <input type="hidden" name={name} value={value ? 'yes' : 'no'} />
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn('rounded-md border px-4 py-1.5 text-sm', value === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
          >
            {v ? 'Yes, share' : 'No'}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function WelcomeForm({ action, collegeName, workforce = false }: { action: (prev: State, formData: FormData) => Promise<State>; collegeName: string; workforce?: boolean }) {
  const [state, formAction] = useActionState(action, null)
  // Defaults per the spec: outcome sharing on, search detail off.
  const [shareOutcome, setShareOutcome] = useState(true)
  const [shareSearchDetail, setShareSearchDetail] = useState(false)
  const [takeCalls, setTakeCalls] = useState(false)
  return (
    <form action={formAction} className="space-y-4">
      <Choice
        name="shareOutcome"
        label={workforce ? `Tell ${collegeName} when you land a job, and where` : `Tell ${collegeName} when you land a job`}
        help={
          workforce
            ? `Your new employer, title and city, so ${collegeName} can count how many people stay in the region. Nothing about your search.`
            : 'Your new employer and title, so the college can celebrate it and keep your record current. Nothing about your search.'
        }
        value={shareOutcome}
        onChange={setShareOutcome}
      />
      <Choice
        name="shareSearchDetail"
        label={workforce ? `Let ${collegeName}'s career team see your progress` : 'Let Career Services see your progress'}
        help="Your weekly progress and activity, so a counselor can help. Never your assessments or messages."
        value={shareSearchDetail}
        onChange={setShareSearchDetail}
      />
      {!workforce && (
      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
        <input type="checkbox" name="takeCalls" checked={takeCalls} onChange={(e) => setTakeCalls(e.target.checked)} className="mt-0.5 size-4" />
        <span>
          <span className="font-medium">I&apos;ll take a call from a fellow alum.</span>
          <span className="block text-muted-foreground">Up to two short calls a month. You can stop any time.</span>
        </span>
      </label>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton size="lg" pendingLabel="Setting you up…">
        See my job market
      </SubmitButton>
    </form>
  )
}
