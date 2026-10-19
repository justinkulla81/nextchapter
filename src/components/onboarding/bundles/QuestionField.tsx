'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { Question } from '@/lib/onboarding/bundles'
import { OptionButtons } from './OptionButtons'
import { SituationCards } from './SituationCards'

// One question, drawn by kind. The value lives in the parent (BundleForm) so nothing is lost on an error.
// `onAnswered` is for analytics: buttons and lists fire it at once, text boxes when the person leaves them.
export function QuestionField({ q, value, onChange, onAnswered }: { q: Question; value: string; onChange: (v: string) => void; onAnswered: (v: string) => void }) {
  const optional = q.required ? null : <span className="font-normal text-muted-foreground"> (optional)</span>
  switch (q.kind) {
    case 'cards':
      return <SituationCards legend={q.label} options={q.options ?? []} value={value} onChange={(v) => { onChange(v); if (v) onAnswered(v) }} />
    case 'choice':
      return <OptionButtons name={q.id} legend={q.label} help={q.help} options={q.options ?? []} value={value} onChange={(v) => { onChange(v); if (v) onAnswered(v) }} />
    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={`q-${q.id}`} className="text-base font-semibold text-ink">{q.label}{optional}</Label>
          <NativeSelect
            id={`q-${q.id}`}
            name={q.id}
            options={[...(q.options ?? [])]}
            defaultValue={value}
            placeholder="Select one"
            className="h-11 text-base"
            onChange={(v) => { onChange(v); if (v) onAnswered(v) }}
          />
        </div>
      )
    case 'text':
    case 'date':
    case 'number':
      return (
        <div className="space-y-2">
          <Label htmlFor={`q-${q.id}`} className="text-base font-semibold text-ink">{q.label}{optional}</Label>
          {q.help && <p className="text-sm text-muted-foreground">{q.help}</p>}
          <Input
            id={`q-${q.id}`}
            name={q.id}
            type={q.kind === 'text' ? 'text' : q.kind}
            inputMode={q.kind === 'number' ? 'numeric' : undefined}
            min={q.kind === 'number' ? q.min : undefined}
            max={q.kind === 'number' ? q.max : undefined}
            maxLength={q.kind === 'text' ? q.maxLength : undefined}
            placeholder={q.placeholder}
            value={value}
            className={q.kind === 'text' ? undefined : 'w-48'}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => { if (e.target.value.trim()) onAnswered(e.target.value) }}
          />
        </div>
      )
    case 'upload':
      return null
  }
}
