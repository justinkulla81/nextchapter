'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { QueuedQuestion } from '@/lib/search-strategy/quick-questions'
import { saveQuickAnswer } from '@/app/dashboard/search-strategy/questions/actions'

const PRIMARY = 'inline-flex h-11 items-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground hover:brightness-95'

/**
 * One question at a time: why we ask first, the choice, what the answer gets the member, and a finish
 * screen that says what they gained. Each answer is saved the moment it is given, so leaving halfway
 * keeps everything answered so far. Four options or fewer are buttons, more are a dropdown.
 */
export function QuickQuestionFlow({ questions, backHref }: { questions: QueuedQuestion[]; backHref: string }) {
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<{ key: string; question: string; label: string; gain: string }[]>([])
  const [skipped, setSkipped] = useState(0)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const total = questions.length
  const q = questions[index]

  if (!q) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <section className="space-y-4 rounded-2xl bg-navy p-8 text-white">
          <h1 className="font-serif text-3xl leading-tight font-semibold">
            {answered.length > 0 ? `You answered ${answered.length} ${answered.length === 1 ? 'question' : 'questions'}.` : 'Nothing answered this time.'}
          </h1>
          {answered.length > 0 && (
            <ul className="space-y-2 text-base text-white/90">
              {answered.map((a) => (
                <li key={a.key} className="flex gap-2">
                  <Check className="mt-1 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">{a.label}.</span> {a.gain}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {skipped > 0 && <p className="text-sm text-muted-foreground">{skipped} skipped. They stay on your strategy page whenever you want them.</p>}
        <Link href={backHref} className={PRIMARY}>
          Back to your strategy
        </Link>
      </div>
    )
  }

  const optionLabel = (value: string) => q.options.find((o) => o.value === value)?.label ?? value

  const advance = () => {
    setSelected('')
    setError(null)
    setIndex((i) => i + 1)
  }

  const save = (value: string) => {
    setSelected(value)
    setError(null)
    startTransition(async () => {
      const result = await saveQuickAnswer(q.key, value)
      if (!result.ok) {
        setError(result.error)
        return
      }
      posthog.capture('search_strategy_question_answered', { key: q.key, field: q.field, position: index + 1, of: total })
      setAnswered((a) => [...a, { key: q.key, question: q.question, label: optionLabel(value), gain: q.gain }])
      advance()
    })
  }

  const skip = () => {
    posthog.capture('search_strategy_question_skipped', { key: q.key, field: q.field, position: index + 1, of: total })
    setSkipped((n) => n + 1)
    advance()
  }

  return (
    <div className={cn('mx-auto max-w-xl space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-navy">
            Question {index + 1} of {total}
          </span>
          <span className="text-muted-foreground">Under a minute</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1} aria-label={`Question ${index + 1} of ${total}`} className="h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-navy" style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }} />
        </div>
      </div>

      {q.why && (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold">Why we ask:</span> {q.why}
        </p>
      )}

      <div className="space-y-4">
        <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight text-navy text-balance">{q.question}</h1>
        {q.buttons ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={q.question}>
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={pending}
                aria-pressed={selected === o.value}
                onClick={() => save(o.value)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-5 text-base transition-colors disabled:opacity-60',
                  selected === o.value ? 'border-navy bg-navy text-white' : 'border-border text-foreground hover:bg-muted'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <NativeSelect key={q.key} name={q.key} options={q.options} placeholder="Choose one" defaultValue={null} onChange={setSelected} aria-label={q.question} />
            <button type="button" disabled={pending || !selected} onClick={() => save(selected)} className={cn(PRIMARY, 'disabled:opacity-60')}>
              {pending ? 'Saving…' : 'Save and continue'}
            </button>
            {!selected && <p className="text-sm text-muted-foreground">Choose an option to continue.</p>}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {q.gain && (
        <p className="rounded-2xl border border-border p-4 text-sm text-foreground">
          <span className="font-semibold">What you get:</span> {q.gain}
        </p>
      )}

      <button type="button" onClick={skip} disabled={pending} className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-60">
        Skip for now
      </button>
    </div>
  )
}
