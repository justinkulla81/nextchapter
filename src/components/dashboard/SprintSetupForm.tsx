'use client'

import { useActionState, useState } from 'react'
import { submitWeeklySprint } from '@/app/dashboard/sprint/actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface SuggestedAction {
  text: string
  actionType?: string
  isAStandard?: boolean
  isStretch?: boolean
}

const DIFFICULTY_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Some effort' },
  { value: 3, label: 'Genuinely hard' },
]

export function SprintSetupForm({ suggestedActions }: { suggestedActions: SuggestedAction[] }) {
  const [state, formAction, pending] = useActionState(submitWeeklySprint, undefined)
  const [selected, setSelected] = useState<boolean[]>(suggestedActions.map(() => true))
  const [difficulty, setDifficulty] = useState<(1 | 2 | 3)[]>(suggestedActions.map(() => 2))

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="actionCount" value={suggestedActions.length} />
      <div className="divide-y divide-border rounded-lg border border-border">
        {suggestedActions.map((action, i) => (
          <div key={i} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <input type="hidden" name={`text_${i}`} value={action.text} />
            {action.actionType && <input type="hidden" name={`actionType_${i}`} value={action.actionType} />}
            <input type="hidden" name={`difficulty_${i}`} value={difficulty[i]} />
            <label className="flex items-start gap-3">
              <Checkbox
                name={`selected_${i}`}
                value="on"
                checked={selected[i]}
                onCheckedChange={(checked) =>
                  setSelected((prev) => prev.map((v, idx) => (idx === i ? Boolean(checked) : v)))
                }
              />
              <span className="text-sm text-foreground">{action.text}</span>
            </label>
            <div className="flex shrink-0 gap-1.5 pl-7 sm:pl-0">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDifficulty((prev) => prev.map((v, idx) => (idx === i ? opt.value : v)))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    difficulty[i] === opt.value
                      ? 'border-brand bg-brand text-white'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Committing…' : "Commit to this week's goals"}
      </Button>
    </form>
  )
}
