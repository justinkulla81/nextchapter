'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import type { PivotMessage } from '@/lib/journey/pivot-scope-message'
import type { ExploreQuestion, ExploredOption } from '@/lib/jobs/search-scope'
import { answerPivotQuestion, forgetExploredOption, markPivotMessageShown, setExploredOption } from '@/app/dashboard/find-my-job/scope-actions'

/**
 * The one message a member sees the first time their search reaches outside home: what is outside, why
 * jobs there fit lower, the skills that close the gap, a way to learn them and a coach offer with its
 * reason. Shown once: the first view saves that it was shown (scope-actions.ts), so a reload does not
 * bring it back. `preview` skips the server for dev-preview.
 */
export function PivotMessageCard({ message, counts, preview = false }: { message: PivotMessage; counts: { functions: number; industries: number; places: number }; preview?: boolean }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (preview) return
    void markPivotMessageShown(counts).catch(() => undefined)
    // Once per mount; the server keeps the count honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (hidden) return null
  const click = (target: 'learn' | 'coach') => posthog.capture('pivot_message_clicked', { target, ...counts })
  return (
    <section aria-labelledby="pivot-message" className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <h2 id="pivot-message" className="font-display text-xl font-semibold text-ink">
        {message.title}
      </h2>
      <p className="text-base text-ink">
        Now included: <span className="font-semibold">{message.outside}</span>. {message.lowerFit}
      </p>
      <p className="text-base text-ink">
        {message.gaps.length > 0 && (
          <>
            Skills that close the gap: <span className="font-semibold">{message.gaps.join(', ')}</span>.{' '}
          </>
        )}
        <Link href={message.learnHref} onClick={() => click('learn')} className="font-semibold text-primary underline underline-offset-4">
          Open the learning plan
        </Link>
      </p>
      <div className="rounded-xl bg-muted/40 p-4">
        <p className="text-base font-semibold text-ink">{message.coach.title}</p>
        <p className="mt-1 text-sm text-ink">{message.coach.why}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message.coach.whyDetail}</p>
        <Link
          href={message.coach.href}
          onClick={() => click('coach')}
          className="mt-3 inline-flex h-10 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95"
        >
          Find my coach
        </Link>
      </div>
      <button type="button" onClick={() => setHidden(true)} className="text-sm text-muted-foreground underline underline-offset-4">
        Got it
      </button>
    </section>
  )
}

/** "Are you exploring a move into X?" One tap saves an explored option that stays off until the member switches it on. */
export function ExploreQuestionCard({ question, preview = false }: { question: ExploreQuestion; preview?: boolean }) {
  const [done, setDone] = useState<'yes' | 'no' | null>(null)
  const [pending, startTransition] = useTransition()
  if (done === 'no') return null
  function answer(a: 'yes' | 'no') {
    posthog.capture('pivot_question_answered', { kind: question.kind, value: question.value, answer: a })
    if (preview) return setDone(a)
    startTransition(async () => {
      await answerPivotQuestion(question.kind, question.value, a).catch(() => undefined)
      setDone(a)
    })
  }
  return (
    <section aria-labelledby="explore-question" className={`rounded-2xl border border-border bg-white p-4 ${pending ? 'cursor-wait' : ''}`}>
      {done === 'yes' ? (
        <p className="text-base text-ink">
          Saved as an option you are exploring. It stays off until you switch it on under &ldquo;Your explored options&rdquo;, so your search has not changed.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p id="explore-question" className="text-base font-semibold text-ink">
            {question.text}
          </p>
          <p className="basis-full text-sm text-muted-foreground">You saved several jobs in this area. Saying yes only saves it as an option to explore.</p>
          <button type="button" disabled={pending} onClick={() => answer('yes')} className="h-10 rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95">
            Yes, save it as an option
          </button>
          <button type="button" disabled={pending} onClick={() => answer('no')} className="h-10 rounded-full border border-border px-6 text-sm font-semibold text-ink">
            No
          </button>
        </div>
      )}
    </section>
  )
}

const KIND_LABEL: Record<ExploredOption['kind'], string> = { function: 'Field', industry: 'Industry', place: 'Place' }

/** The explored options with an on/off switch each. Off options change nothing in the search or in fit. */
export function ExploredOptionsList({ options, preview = false }: { options: ExploredOption[]; preview?: boolean }) {
  const [list, setList] = useState(options)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (list.length === 0) return null
  function toggle(o: ExploredOption) {
    const on = !o.on
    const before = list
    setList((l) => l.map((x) => (x.kind === o.kind && x.value === o.value ? { ...x, on } : x)))
    if (preview) return
    startTransition(async () => {
      const r = await setExploredOption(o.kind, o.value, on, o.source).catch(() => ({ error: 'We could not save that. Try again.' }))
      if (r.error) {
        setList(before)
        setError(r.error)
      } else {
        setError(null)
        window.location.reload()
      }
    })
  }
  function forget(o: ExploredOption) {
    setList((l) => l.filter((x) => !(x.kind === o.kind && x.value === o.value)))
    if (!preview) startTransition(async () => void (await forgetExploredOption(o.kind, o.value).catch(() => undefined)))
  }
  return (
    <details className={`rounded-lg border border-border px-3 py-2 ${pending ? 'cursor-wait' : ''}`}>
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Your explored options ({list.filter((o) => o.on).length} on of {list.length})
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">Switch one on to add it to Broader. Everything includes all of them. Off options change nothing in your search or your fit.</p>
      <ul className="mt-2 divide-y divide-border">
        {list.map((o) => (
          <li key={`${o.kind}:${o.value}`} className="flex flex-wrap items-center gap-3 py-2">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{KIND_LABEL[o.kind]}</span>
            <span className="text-base text-ink">{o.value}</span>
            <button
              type="button"
              role="switch"
              aria-checked={o.on}
              disabled={pending}
              onClick={() => toggle(o)}
              className={`ml-auto h-8 rounded-full border px-4 text-sm font-semibold ${o.on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-ink'}`}
            >
              {o.on ? 'On' : 'Off'}
            </button>
            <button type="button" disabled={pending} onClick={() => forget(o)} className="text-sm text-muted-foreground underline underline-offset-4" aria-label={`Remove ${o.value} from explored options`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </details>
  )
}
