'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { previewMatches, type BundleFormState } from '@/app/onboarding/bundle-actions'
import { usePostHog } from '@/lib/posthog/client'
import type { JourneyType } from '@/lib/journey/journey'
import { SITUATION_SESSION_KEY } from '@/lib/constants/onboarding'
import { BUNDLES, bundleQuestions, journeyOfSituation, openRequired, type Answers, type BundleId, type QuestionId } from '@/lib/onboarding/bundles'
import { computePayoff, type JobCounts, type PayoffInput } from '@/lib/onboarding/payoff'
import { cn } from '@/lib/utils'
import { PayoffPanel } from './PayoffPanel'
import { PrimaryAction } from './PrimaryAction'
import { QuestionField } from './QuestionField'

// A short bundle of questions: at most three at a time, the payoff under them updating as each is answered,
// and one primary action. For the two bundles that tune job matching it also asks the server how many jobs fit
// the answers on screen (not saved yet). Answers live here, so an error never clears anything.
export function BundleForm({
  bundle,
  initial,
  storedJourney,
  payoffInput,
  action,
  previewJobs,
  hidden,
}: {
  bundle: BundleId
  initial: Answers
  storedJourney: JourneyType | null
  payoffInput: Omit<PayoffInput, 'journey' | 'jobs'>
  action: (prev: BundleFormState, formData: FormData) => Promise<BundleFormState>
  /** Which job-count preview to run, if any. */
  previewJobs?: 'aiming' | 'where'
  /** Extra values the server action reads that are not questions (for example where the visitor came from). */
  hidden?: Record<string, string>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [answers, setAnswers] = useState<Answers>(initial)
  const [jobs, setJobs] = useState<JobCounts | null>(null)
  const [counting, setCounting] = useState(false)
  const baseline = useRef<{ value: number | null } | null>(null)
  const latest = useRef(0)
  const posthog = usePostHog()

  // The situation card decides the journey on the first bundle; later bundles use the one already saved.
  const journey = bundle === 'where_you_are' ? (journeyOfSituation(answers.situation) ?? null) : storedJourney
  const questions = useMemo(() => bundleQuestions(bundle, { journey }), [bundle, journey])
  const open = openRequired(bundle, { journey }, answers)

  const set = (id: QuestionId, v: string) => setAnswers((a) => ({ ...a, [id]: v }))

  // A homepage or persona-page click already answered the situation card: preselect it, so they only confirm.
  // (The classic step auto-submits; here the follow-up question still needs an answer.)
  useEffect(() => {
    if (bundle !== 'where_you_are') return
    let stored: string | null = null
    try {
      stored = sessionStorage.getItem(SITUATION_SESSION_KEY)
      sessionStorage.removeItem(SITUATION_SESSION_KEY)
    } catch {
      // Private windows can block storage; the card is simply not preselected.
    }
    if (!stored || !journeyOfSituation(stored)) return
    const picked = stored
    const timer = setTimeout(() => setAnswers((a) => (a.situation ? a : { ...a, situation: picked })), 0)
    return () => clearTimeout(timer)
  }, [bundle])

  // The live job count. Debounced so typing does not hit the server on every key; a late reply for an older
  // set of answers is dropped.
  const countKey = previewJobs ? JSON.stringify(answers) : ''
  useEffect(() => {
    if (!previewJobs) return
    const ready = previewJobs === 'aiming' ? !!answers.function && !!answers.level : !!answers.workSetup
    if (!ready) return
    const mine = ++latest.current
    const timer = setTimeout(async () => {
      setCounting(true)
      const result = await previewMatches(previewJobs, answers, baseline.current === null)
      if (mine !== latest.current) return
      if (baseline.current === null) baseline.current = { value: result.baseline }
      setJobs({ baseline: baseline.current.value, now: result.now })
      setCounting(false)
    }, 500)
    return () => clearTimeout(timer)
    // answers is captured through countKey; the effect must re-run only when an answer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countKey, previewJobs])

  const payoff = computePayoff(bundle, answers, { ...payoffInput, journey, jobs })
  const reason = open.length > 0 ? `Answer “${open[0].label}”${open.length > 1 ? ` and ${open.length - 1} more` : ''} to continue.` : null

  return (
    <form action={formAction} className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="space-y-6">
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            q={q}
            value={answers[q.id] ?? ''}
            onChange={(v) => set(q.id, v)}
            onAnswered={() => posthog?.capture('onboarding_question_answered', { bundleId: bundle, questionId: q.id, journey })}
          />
        ))}
      </div>

      <PayoffPanel payoff={payoff} busy={counting} />

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <PrimaryAction pending={pending} pendingLabel="Saving…" disabledReason={reason}>
        {BUNDLES[bundle].action}
      </PrimaryAction>
    </form>
  )
}
