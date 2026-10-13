'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { saveWeightsForm } from '@/app/i/[slug]/(portal)/outreach-actions'

type W = { key: string; label: string; category: string; defaultPoints: number }

// Points per activity, with the CASE category each one counts toward. Inputs
// stay as typed if a save fails.
export function WeightsForm({ slug, keys, values }: { slug: string; keys: W[]; values: Record<string, number> }) {
  const [state, action] = useActionState(saveWeightsForm.bind(null, slug), undefined)
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(keys.map((k) => [k.key, String(values[k.key])])))
  return (
    <form action={action} className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Engagement points per activity</caption>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Activity</th>
              <th scope="col" className="px-3 py-2 font-medium">CASE category</th>
              <th scope="col" className="px-3 py-2 font-medium">Points</th>
              <th scope="col" className="px-3 py-2 font-medium">Standard</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.map((k) => (
              <tr key={k.key}>
                <td className="px-3 py-2">
                  <label htmlFor={`w-${k.key}`}>{k.label}</label>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{k.category.charAt(0) + k.category.slice(1).toLowerCase()}</td>
                <td className="px-3 py-1">
                  <Input id={`w-${k.key}`} name={k.key} inputMode="numeric" className="h-8 w-16" value={v[k.key]} onChange={(e) => setV({ ...v, [k.key]: e.target.value })} />
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{k.defaultPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save weights</SubmitButton>
        <SubmitButton variant="ghost" name="reset" value="1" pendingLabel="Resetting…">
          Reset to standard
        </SubmitButton>
        {(state?.error || state?.message) && (
          <p role={state.error ? 'alert' : 'status'} className={state.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {state.error ?? state.message}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Monthly caps stay in points: sign-ins and email links count up to 4 a month, tool use up to 8, gifts up to 10 a year.</p>
    </form>
  )
}
