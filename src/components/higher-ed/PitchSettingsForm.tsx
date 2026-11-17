'use client'

import { useActionState } from 'react'
import { savePitchSettings, type BusinessResult } from '@/app/i/[slug]/(portal)/business-actions'
import type { PitchSettings } from '@/lib/workforce/business-pitch'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Business Hub › Incentives and costs. Every line the pitch shows from here needs its source, so the form asks for one.
// Up to four incentives; office cost per square foot a year. Inputs keep their values on an error (the form re-renders
// with what was typed, since the browser keeps uncontrolled values).
export function PitchSettingsForm({ slug, value }: { slug: string; value: PitchSettings }) {
  const [state, action] = useActionState<BusinessResult, FormData>(savePitchSettings.bind(null, slug), undefined)
  const rows = [0, 1, 2, 3].map((k) => value.incentives[k] ?? { name: '', detail: '', source: '' })
  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="pitchLine">Your one-line pitch</Label>
        <Input id="pitchLine" name="pitchLine" defaultValue={value.pitchLine ?? ''} maxLength={200} placeholder="Louisville: the talent of a big city at the cost of a small one." />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Incentives a company could use</legend>
        <p className="text-xs text-muted-foreground">Tax credits, grants, training funds, site help. Each needs where it comes from, so the pitch can cite it.</p>
        {rows.map((r, k) => (
          <div key={k} className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`incentiveName${k}`}>Name</Label>
              <Input id={`incentiveName${k}`} name={`incentiveName${k}`} defaultValue={r.name} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`incentiveDetail${k}`}>What it gives</Label>
              <Input id={`incentiveDetail${k}`} name={`incentiveDetail${k}`} defaultValue={r.detail} maxLength={400} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`incentiveSource${k}`}>Source (link or agency)</Label>
              <Input id={`incentiveSource${k}`} name={`incentiveSource${k}`} defaultValue={r.source} maxLength={300} />
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Office space</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="officePerSqFt">Dollars per square foot a year</Label>
            <Input id="officePerSqFt" name="officePerSqFt" inputMode="decimal" defaultValue={value.officeCost?.perSqFtYear ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="officeNote">Note</Label>
            <Input id="officeNote" name="officeNote" defaultValue={value.officeCost?.note ?? ''} maxLength={300} placeholder="Class A, downtown" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="officeSource">Source</Label>
            <Input id="officeSource" name="officeSource" defaultValue={value.officeCost?.source ?? ''} maxLength={300} placeholder="A broker's market report" />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save pitch details</SubmitButton>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state?.ok && <p className="text-sm text-muted-foreground">{state.message}</p>}
      </div>
    </form>
  )
}
