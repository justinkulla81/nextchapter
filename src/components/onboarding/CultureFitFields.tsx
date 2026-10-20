'use client'

import { useState } from 'react'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DIMENSIONS, IMPORTANCE, type CultureFit } from '@/lib/culture/culture-fit'

// Company culture and working environment, part of Search Strategy. One
// question first: how much does it matter? If it does not, nothing else is
// asked. If it does, a few short questions say what they want; each can be
// left blank. Used in onboarding and on the Search Strategy page; the parent
// form saves the named fields (cultureImportance, culture_<dimension>,
// cultureMustHave, cultureDealBreaker).
export function CultureFitFields({ defaults }: { defaults: CultureFit | null }) {
  const [importance, setImportance] = useState<string | null>(defaults?.importance ?? null)
  const [answers, setAnswers] = useState<Record<string, string | null>>(() => Object.fromEntries(DIMENSIONS.map((d) => [d.key, defaults?.answers[d.key] ?? null])))
  const matters = importance === 'SOMEWHAT' || importance === 'VERY'

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>How much do company culture and working environment matter to you?</Label>
        <ChoiceButtons name="cultureImportance" options={IMPORTANCE.map((i) => ({ value: i.key, label: i.label }))} value={importance} onChange={setImportance} columns={3} responsive />
        {importance === 'NOT_IMPORTANT' && <p className="text-sm text-muted-foreground">Got it. We will leave culture out of your plan.</p>}
      </div>

      {matters && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Pick what fits you, or leave a question blank. These become questions to ask in interviews and checks on an offer.</p>
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="space-y-1.5">
              <Label>{d.question}</Label>
              <ChoiceButtons
                name={`culture_${d.key}`}
                options={d.options.map((o) => ({ value: o.key, label: o.label }))}
                value={answers[d.key]}
                onChange={(v) => setAnswers((a) => ({ ...a, [d.key]: v }))}
                columns={2}
                responsive
              />
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cultureMustHave">One thing a workplace must have</Label>
              <Input id="cultureMustHave" name="cultureMustHave" maxLength={200} defaultValue={defaults?.mustHave ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cultureDealBreaker">One thing you will not accept</Label>
              <Input id="cultureDealBreaker" name="cultureDealBreaker" maxLength={200} defaultValue={defaults?.dealBreaker ?? ''} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
