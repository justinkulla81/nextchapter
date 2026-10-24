'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import type { HelpAudience } from '@/lib/help/constants'
import { addNpsComment, dismissNps, submitNpsScore } from '@/lib/nps/actions'
import { NPS_HIGH_LABEL, NPS_LOW_LABEL, NPS_QUESTION, npsCategory } from '@/lib/nps/score'

const SCORES = Array.from({ length: 11 }, (_, i) => i)

type Step = 'score' | 'comment' | 'done'

/**
 * The "how likely are you to recommend us" question, in the corner of the
 * portal. Not a modal: it never blocks the page. Picking a number saves it at
 * once; the reason is optional. The 0-10 scale is a rating, not a choice
 * between options, so it is a row of numbers rather than a dropdown.
 */
export function NpsPrompt({ audience }: { audience: HelpAudience }) {
  const pathname = usePathname() ?? ''
  const posthog = usePostHog()
  const [step, setStep] = useState<Step>('score')
  const [score, setScore] = useState<number | null>(null)
  const [responseId, setResponseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const [pending, startTransition] = useTransition()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current) return
    shown.current = true
    posthog?.capture('nps_prompt_shown', { audience, page: pathname })
  }, [posthog, audience, pathname])

  // Leaves the page by itself a few seconds after the thank-you.
  useEffect(() => {
    if (step !== 'done') return
    const t = setTimeout(() => setHidden(true), 4000)
    return () => clearTimeout(t)
  }, [step])

  if (hidden) return null

  function pick(n: number) {
    setScore(n)
    setError(null)
    startTransition(async () => {
      const res = await submitNpsScore(audience, n, pathname)
      if (!res.ok) { setError(res.error); return }
      setResponseId(res.responseId ?? null)
      setStep('comment')
    })
  }

  function sendComment(formData: FormData) {
    const text = String(formData.get('comment') ?? '')
    if (!responseId) return
    setError(null)
    startTransition(async () => {
      const res = await addNpsComment(audience, responseId, text)
      if (!res.ok) { setError(res.error); return }
      setStep('done')
    })
  }

  function notNow() {
    setError(null)
    startTransition(async () => {
      const res = await dismissNps(audience, pathname)
      if (!res.ok) { setError(res.error); return }
      setHidden(true)
    })
  }

  return (
    <section
      aria-labelledby="nps-title"
      className={`fixed right-4 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-30 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl lg:right-6 lg:bottom-20 ${pending ? 'cursor-wait' : ''}`}
    >
      {step === 'score' && (
        <>
          <h2 id="nps-title" className="text-sm font-semibold text-navy">{NPS_QUESTION}</h2>
          <div role="radiogroup" aria-labelledby="nps-title" className="mt-3 grid grid-cols-11 gap-1">
            {SCORES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={score === n}
                disabled={pending}
                onClick={() => pick(n)}
                className={`rounded-md border py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait ${
                  score === n ? 'border-brand bg-brand/10 text-navy ring-1 ring-brand' : 'border-border bg-white text-foreground hover:bg-muted'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{NPS_LOW_LABEL}</span>
            <span>{NPS_HIGH_LABEL}</span>
          </div>
          {error && <p role="alert" className="mt-2 text-sm font-medium text-error">{error}</p>}
          <button type="button" onClick={notNow} disabled={pending} className="mt-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:cursor-wait">
            Not now
          </button>
        </>
      )}

      {step === 'comment' && score !== null && (
        <form action={sendComment}>
          <h2 id="nps-title" className="text-sm font-semibold text-navy">
            {npsCategory(score) === 'promoter' ? 'What do you like most?' : 'What is the main reason for your score?'}
          </h2>
          <label htmlFor="nps-comment" className="sr-only">Reason for your score of {score}</label>
          <textarea
            id="nps-comment"
            name="comment"
            rows={3}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
          />
          {error && <p role="alert" className="mt-1 text-sm font-medium text-error">{error}</p>}
          <div className="mt-2 flex items-center gap-4">
            <button type="submit" disabled={pending} className="inline-flex items-center rounded-lg bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70">
              {pending ? 'Sending…' : 'Send reason'}
            </button>
            <button type="button" onClick={() => setStep('done')} disabled={pending} className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Skip
            </button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <p id="nps-title" role="status" className="text-sm font-semibold text-navy">Thank you.</p>
      )}
    </section>
  )
}
