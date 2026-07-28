'use client'

import { useState, useTransition } from 'react'
import { saveOnboardingTemplate } from '@/app/support/coach/(app)/settings/[token]/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CUSTOM_QUESTION_TYPES,
  STARTER_QUESTION_LIBRARY,
  type EffectiveTemplateQuestion,
  type OnboardingQuestionType,
} from '@/lib/coach/onboarding-form-shared'
import type { CoachingFocus } from '@prisma/client'
import { cn } from '@/lib/utils'

function newCustomQuestion(): EffectiveTemplateQuestion {
  return {
    id: `custom:${crypto.randomUUID()}`,
    source: 'custom',
    section: 'General',
    label: '',
    type: 'short_text',
    enabled: true,
  }
}

// Prompt 60's coach-facing "Coaching Onboarding Form" template editor — the
// candidate-completed self-serve kickoff questionnaire. This is a DIFFERENT
// tool from any coach-completed sensitive-topics intake (not built in this
// codebase); keep the naming and placement unambiguous so the two are never
// confused if that one is ever added later.
export function OnboardingTemplateEditor({
  token,
  focus,
  initialTemplate,
}: {
  token: string
  focus: CoachingFocus
  initialTemplate: EffectiveTemplateQuestion[]
}) {
  const [template, setTemplate] = useState(initialTemplate)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function update(id: string, patch: Partial<EffectiveTemplateQuestion>) {
    setSaved(false)
    setTemplate((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  function move(index: number, direction: -1 | 1) {
    setSaved(false)
    setTemplate((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function remove(id: string) {
    setSaved(false)
    setTemplate((prev) => prev.filter((q) => q.id !== id))
  }

  function addCustom(prefill?: { label: string; type: Exclude<OnboardingQuestionType, 'date'>; options?: string[] }) {
    setSaved(false)
    const q = newCustomQuestion()
    if (prefill) {
      q.label = prefill.label
      q.type = prefill.type
      q.options = prefill.options
    }
    setTemplate((prev) => [...prev, q])
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveOnboardingTemplate(token, template)
      if (result?.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  const starters = STARTER_QUESTION_LIBRARY[focus]

  return (
    <div className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-3">
        {template.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`enabled-${q.id}`}
                  checked={q.enabled}
                  onCheckedChange={(checked) => update(q.id, { enabled: checked === true })}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {q.source === 'baseline' ? (
                    <Label htmlFor={`enabled-${q.id}`} className="font-normal text-foreground">
                      {q.label}
                    </Label>
                  ) : (
                    <Input
                      value={q.label}
                      onChange={(e) => update(q.id, { label: e.target.value })}
                      placeholder="Question text"
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {q.source === 'baseline' && <span>Baseline</span>}
                    <span>Section:</span>
                    <Input
                      value={q.section}
                      onChange={(e) => update(q.id, { section: e.target.value })}
                      className="h-6 w-32 px-2 py-0 text-xs"
                      placeholder="Section"
                    />
                  </div>
                  {q.source === 'custom' && (
                    <div className="flex flex-wrap gap-1.5">
                      {CUSTOM_QUESTION_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => update(q.id, { type: t.value })}
                          aria-pressed={q.type === t.value}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs',
                            q.type === t.value
                              ? 'border-brand bg-brand/5 text-brand'
                              : 'border-border text-muted-foreground hover:border-brand/40'
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.source === 'custom' && q.type === 'multiple_choice' && (
                    <Textarea
                      value={(q.options ?? []).join('\n')}
                      onChange={(e) => update(q.id, { options: e.target.value.split('\n') })}
                      placeholder={'One option per line'}
                      rows={3}
                    />
                  )}
                  {q.source === 'custom' && q.type === 'scale' && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Max value</Label>
                      <Input
                        type="number"
                        min={2}
                        max={10}
                        value={q.scaleMax ?? 5}
                        onChange={(e) => update(q.id, { scaleMax: Number(e.target.value) })}
                        className="h-8 w-20"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === template.length - 1}
                  aria-label="Move down"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  ↓
                </button>
                {q.source === 'custom' && (
                  <button
                    type="button"
                    onClick={() => remove(q.id)}
                    aria-label="Remove question"
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-sm font-medium text-foreground">Add a custom question</p>
        <Button type="button" variant="outline" size="sm" onClick={() => addCustom()}>
          + Blank question
        </Button>
        {starters.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Suggested for your focus:</p>
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => addCustom(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:border-brand/40"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !pending && <p className="text-sm text-brand">Template saved.</p>}
      <Button type="button" disabled={pending} onClick={save}>
        {pending ? 'Saving…' : 'Save template'}
      </Button>
    </div>
  )
}
