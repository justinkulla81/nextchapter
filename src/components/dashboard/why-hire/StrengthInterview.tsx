'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { AREAS, areaOf, nextStep, type AreaKey, type AreaSummary, type ReflectionRow, type SavedAnswer } from '@/lib/strengths-interview/areas'
import type { FinishResult, SaveAnswerResult } from '@/app/dashboard/strengths/discover/actions'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Meter } from '@/components/candidate/ui'
import { Spinner } from '@/components/ui/spinner'
import { CopyText } from './CopyText'
import { cn } from '@/lib/utils'

// Find your strengths: free-form questions, one at a time, area by area. Each answer can bring one follow-up that
// asks for the specifics; each finished area ends with a reveal of the strength, the proof, a line to say, and (only
// for the member) the weaker spot to plan for. The hub lists the six areas and where the member is in each.

export type { ReflectionRow }

export interface InterviewActions {
  save: (input: { area: string; questionKey: string; text: string; isFollowUp: boolean }) => Promise<SaveAnswerResult>
  skipFollowUp: (input: { area: string; questionKey: string }) => Promise<SaveAnswerResult>
  finish: (area: string) => Promise<FinishResult>
}

const BASE = '/dashboard/strengths/discover'
const BACK = '/dashboard/strengths'

export function StrengthInterview({ area, rows, redo = false, actions }: { area: AreaKey | null; rows: ReflectionRow[]; redo?: boolean; actions: InterviewActions }) {
  const done = rows.filter((r) => r.completed).length
  if (!area) return <Hub rows={rows} done={done} />
  return <AreaFlow key={`${area}-${redo}`} areaKey={area} row={rows.find((r) => r.area === area)} rows={rows} redo={redo} actions={actions} />
}

// ---- Hub ------------------------------------------------------------------------------------------------------------

function Hub({ rows, done }: { rows: ReflectionRow[]; done: number }) {
  const next = AREAS.find((a) => !rows.find((r) => r.area === a.key)?.completed)
  return (
    <div className="space-y-8">
      <PageHeader
        title="Find your strengths"
        intro="Most people can’t say what they’re best at until someone asks the right questions. Six short areas, two questions each, in your own words."
        action={
          next ? (
            <Link href={`${BASE}?area=${next.key}`} onClick={() => posthog.capture('strength_interview_started', { area: next.key, areasDone: done, from: 'hub' })} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
              {done === 0 ? 'Start with your best work' : `Next: ${next.title.toLowerCase()}`}
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-3">
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Why we ask:</span> what you say here becomes your “why hire me”, your pitch and the strengths you lead with. Weaker spots stay private: only you see them, never employers.
        </p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-ink">{done} of {AREAS.length} areas done</span>
            <span className="text-muted-foreground">About 3 minutes each</span>
          </div>
          <Meter pct={Math.round((done / AREAS.length) * 100)} label="Areas done" tone="good" />
        </div>
      </div>
      <ol aria-label="Areas" className="divide-y divide-border rounded-2xl border border-border">
        {AREAS.map((a, i) => {
          const r = rows.find((x) => x.area === a.key)
          const started = !!r && r.answers.length > 0 && !r.completed
          return (
            <li key={a.key} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 flex-1 basis-64 space-y-0.5">
                <p className="text-base font-semibold text-ink">
                  {i + 1}. {a.title}
                </p>
                {r?.completed && r.summary ? (
                  <p className="text-sm text-ink">
                    <span className="font-medium">Your strength:</span> {r.summary.strength}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{a.why}</p>
                )}
              </div>
              <Link
                href={r?.completed ? `${BASE}?area=${a.key}&redo=1` : `${BASE}?area=${a.key}`}
                onClick={() => posthog.capture('strength_interview_started', { area: a.key, areasDone: done, from: 'hub_row', redo: !!r?.completed })}
                className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
              >
                {r?.completed ? 'Answer again' : started ? 'Continue' : 'Start'}
              </Link>
            </li>
          )
        })}
      </ol>
      <Link href={BACK} className="text-sm font-medium text-brand underline underline-offset-4">
        Back to Why hire me
      </Link>
    </div>
  )
}

// ---- One area -------------------------------------------------------------------------------------------------------

function AreaFlow({ areaKey, row, rows, redo, actions }: { areaKey: AreaKey; row: ReflectionRow | undefined; rows: ReflectionRow[]; redo: boolean; actions: InterviewActions }) {
  const area = areaOf(areaKey)!
  const index = AREAS.findIndex((a) => a.key === areaKey)
  const [answers, setAnswers] = useState<SavedAnswer[]>(redo ? [] : (row?.answers ?? []))
  const [skipped, setSkipped] = useState<string[]>([])
  const [summary, setSummary] = useState<AreaSummary | null>(!redo && row?.completed ? row.summary : null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const box = useRef<HTMLTextAreaElement>(null)
  const step = nextStep(area, answers, skipped)
  const answeredAny = answers.some((a) => a.answer.trim())

  // Every question asked: write the summary (unless this visit already has one).
  const finishing = step.kind === 'done' && !summary && answeredAny
  const asked = useRef(false)
  useEffect(() => {
    if (!finishing || asked.current) return
    asked.current = true
    startTransition(async () => {
      const r = await actions.finish(area.key)
      if (r.ok) setSummary(r.summary)
      else setError(r.error)
    })
  }, [finishing, actions, area.key])

  const othersDone = rows.filter((r) => r.completed && r.area !== area.key).length
  const nextArea = AREAS.find((a) => a.key !== area.key && !rows.find((r) => r.area === a.key)?.completed)

  if (summary) return <Reveal areaTitle={area.title} summary={summary} done={othersDone + 1} nextArea={nextArea ? { key: nextArea.key, title: nextArea.title } : null} />

  if (step.kind === 'done') {
    return (
      <div className={cn('space-y-6', pending && 'cursor-wait')}>
        <AreaTop title={area.title} index={index} why={area.why} />
        {answeredAny ? (
          <p className="flex items-center gap-2 text-base text-muted-foreground" aria-live="polite">
            {pending && <Spinner size={14} />} {error ?? 'Writing what this says about you…'}
          </p>
        ) : (
          <p className="text-base text-ink">You skipped both questions here. That’s fine: come back when something comes to mind.</p>
        )}
        {error && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              startTransition(async () => {
                const r = await actions.finish(area.key)
                if (r.ok) setSummary(r.summary)
                else setError(r.error)
              })
            }}
            className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95"
          >
            Try again
          </button>
        )}
        <Link href={BASE} className="block text-sm font-medium text-brand underline underline-offset-4">
          All areas
        </Link>
      </div>
    )
  }

  const q = step.question
  const isFollowUp = step.kind === 'followUp'
  const prior = isFollowUp ? answers.find((a) => a.questionKey === q.key) : null
  const submit = () => {
    if (!text.trim()) {
      setError('Write a few words first, or skip this question.')
      box.current?.focus()
      return
    }
    setError(null)
    startTransition(async () => {
      const r = await actions.save({ area: area.key, questionKey: q.key, text, isFollowUp })
      if (r.ok) {
        setAnswers(r.answers)
        setText('')
      } else setError(r.error)
    })
  }
  const skip = () => {
    setError(null)
    posthog.capture('strength_question_skipped', { area: area.key, questionKey: q.key, isFollowUp })
    if (isFollowUp) {
      startTransition(async () => {
        const r = await actions.skipFollowUp({ area: area.key, questionKey: q.key })
        if (r.ok) setAnswers(r.answers)
        setSkipped((s) => [...s, `${q.key}:follow`])
        setText('')
      })
    } else {
      setSkipped((s) => [...s, q.key])
      setText('')
    }
  }
  const qNumber = area.questions.findIndex((x) => x.key === q.key) + 1

  return (
    <div className={cn('space-y-6', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <AreaTop title={area.title} index={index} why={area.why} />
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Question {qNumber} of {area.questions.length}
          {isFollowUp ? ', one more on that' : ''}
          {q.kind === 'weakness' ? ' · only you see this one' : ''}
        </p>
        {prior && (
          <blockquote className="border-l-2 border-border pl-4 text-sm text-muted-foreground">
            You said: “{prior.answer.length > 220 ? `${prior.answer.slice(0, 220)}…` : prior.answer}”
          </blockquote>
        )}
        <h2 id="q-h" className="font-display text-2xl leading-tight font-semibold text-ink">
          {isFollowUp ? step.followUp : q.text}
        </h2>
        <textarea
          ref={box}
          aria-labelledby="q-h"
          rows={5}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write it the way you’d say it. A few sentences is plenty."
          className="w-full rounded-xl border border-border p-3.5 text-base text-ink focus:border-ink focus:outline-none"
        />
        {!isFollowUp && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Not sure? Start with one of these:</p>
            <div className="flex flex-wrap gap-2">
              {q.starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setText((t) => (t.trim() ? `${t.trim()} ${s}` : s))
                    posthog.capture('strength_starter_used', { area: area.key, questionKey: q.key })
                    box.current?.focus()
                  }}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm text-ink hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          aria-busy={pending}
          className={cn('inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95', pending && 'opacity-70')}
        >
          {pending ? (isFollowUp ? 'Saving…' : 'Reading your answer…') : 'Save and continue'}
        </button>
        <button type="button" onClick={skip} disabled={pending} className="text-sm font-medium text-brand underline underline-offset-4">
          Skip this question
        </button>
      </div>
      <p className="text-sm text-muted-foreground">Saved as you go. You can stop any time and pick up where you left off.</p>
    </div>
  )
}

function AreaTop({ title, index, why }: { title: string; index: number; why: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <Link href={BASE} className="font-medium text-brand underline underline-offset-4">
          All areas
        </Link>
        <span className="text-muted-foreground">
          Area {index + 1} of {AREAS.length}
        </span>
      </div>
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">{title}</h1>
      <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink">
        <span className="font-semibold">Why we ask:</span> {why}
      </p>
    </div>
  )
}

function Reveal({ areaTitle, summary, done, nextArea }: { areaTitle: string; summary: AreaSummary; done: number; nextArea: { key: string; title: string } | null }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="reveal-h" className="space-y-5 rounded-2xl bg-ink p-8 text-white">
        <p className="text-sm font-medium text-white/80">{areaTitle}: what this says about you</p>
        <h1 id="reveal-h" className="font-display text-3xl leading-tight font-semibold">
          {summary.strength}
        </h1>
        <p className="max-w-2xl text-base text-white/90">
          <span className="font-semibold text-white">The proof:</span> {summary.proof}
        </p>
        <div className="max-w-2xl space-y-3 rounded-xl bg-white p-5 text-ink">
          <p className="text-sm font-semibold">Say it like this</p>
          <p className="font-display text-lg leading-snug">“{summary.sayIt}”</p>
          <CopyText text={summary.sayIt} kind="strength_say_it" />
        </div>
        {summary.watchOut && (
          <p className="max-w-2xl text-base text-white/90">
            <span className="font-semibold text-white">Go in with a plan (only you see this):</span> {summary.watchOut}
          </p>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>
              {done} of {AREAS.length} areas done
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20" role="meter" aria-valuenow={done} aria-valuemin={0} aria-valuemax={AREAS.length} aria-label="Areas done">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.round((done / AREAS.length) * 100)}%` }} />
          </div>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {nextArea ? (
          <Link
            href={`${BASE}?area=${nextArea.key}`}
            onClick={() => posthog.capture('strength_interview_started', { area: nextArea.key, areasDone: done, from: 'reveal' })}
            className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95"
          >
            Next: {nextArea.title.toLowerCase()}
          </Link>
        ) : (
          <Link href={BACK} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
            See your Why hire me
          </Link>
        )}
        <Link href={nextArea ? BACK : BASE} className="text-sm font-medium text-brand underline underline-offset-4">
          {nextArea ? 'Stop here and see your Why hire me' : 'All areas'}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">Your Why hire me and your pitch now use this. Write your pitch again on Your pitch to pick it up there.</p>
    </div>
  )
}
