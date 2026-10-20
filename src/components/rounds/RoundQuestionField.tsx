'use client'

import { Check } from 'lucide-react'
import { OptionButtons } from '@/components/onboarding/bundles/OptionButtons'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { joinList, optionLabels, type RoundAnswers, type RoundQuestion } from '@/lib/redesign/rounds'

// One question of a round, drawn by kind. Two to four options are adjacent buttons, five or more a dropdown
// (design-principles.md). Picking several, or ranking, is a row of toggle chips: a dropdown cannot do it, the same
// tradeoff MultiChoiceButtons documents. The answer lives in the parent, so an error never clears anything.
export function RoundQuestionField({ q, answers, onChange }: { q: RoundQuestion; answers: RoundAnswers; onChange: (values: string[]) => void }) {
  const value = answers[q.id] ?? []
  switch (q.kind) {
    case 'buttons':
      return <OptionButtons name={q.id} legend={q.label} help={q.help} options={q.options ?? []} value={value[0] ?? ''} onChange={(v) => onChange(v ? [v] : [])} />
    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={`round-${q.id}`} className="text-base font-semibold text-ink">{q.label}</Label>
          {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}
          <NativeSelect id={`round-${q.id}`} name={q.id} options={[...(q.options ?? [])]} defaultValue={value[0] ?? ''} placeholder="Select one" className="h-11 text-base" onChange={(v) => onChange(v ? [v] : [])} />
        </div>
      )
    case 'multi':
    case 'rank':
      return <ToggleChips q={q} value={value} onChange={onChange} answers={answers} />
    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor={`round-${q.id}`} className="text-base font-semibold text-ink">{q.label}<span className="font-normal text-muted-foreground"> (optional)</span></Label>
          {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}
          <Textarea id={`round-${q.id}`} name={q.id} rows={3} maxLength={q.maxLength} placeholder={q.placeholder} value={value[0] ?? ''} onChange={(e) => onChange(e.target.value.trim() ? [e.target.value] : [])} />
        </div>
      )
  }
}

function ToggleChips({ q, value, onChange, answers }: { q: RoundQuestion; value: string[]; onChange: (values: string[]) => void; answers: RoundAnswers }) {
  const ranked = q.kind === 'rank'
  function toggle(v: string) {
    if (value.includes(v)) return onChange(value.filter((x) => x !== v))
    if (q.exclusive && v === q.exclusive) return onChange([v])
    const next = [...value.filter((x) => x !== q.exclusive), v]
    if (q.max !== undefined && next.length > q.max) return
    onChange(next)
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-semibold text-ink">{q.label}</legend>
      {(q.help || ranked) && <p className="text-sm text-muted-foreground">{q.help ?? 'Pick in order.'}</p>}
      <div className="flex flex-wrap gap-2">
        {(q.options ?? []).map((o) => {
          const at = value.indexOf(o.value)
          const on = at !== -1
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                on ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink hover:bg-muted/60',
              )}
            >
              {on && (ranked ? <span aria-hidden className="text-xs font-semibold">{at + 1}</span> : <Check className="size-4" aria-hidden />)}
              {o.label}
            </button>
          )
        })}
      </div>
      {ranked && value.length > 0 && <p className="text-sm text-muted-foreground">Your order: {joinList(optionLabels(q, answers))}</p>}
    </fieldset>
  )
}
