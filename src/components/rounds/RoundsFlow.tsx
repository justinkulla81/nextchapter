'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Meter } from '@/components/candidate/ui'
import { PayoffPanel } from '@/components/onboarding/bundles/PayoffPanel'
import { PrimaryAction } from '@/components/onboarding/bundles/PrimaryAction'
import { PrimaryLink } from '@/components/onboarding/bundles/PrimaryLink'
import type { NextQuestion } from '@/lib/onboarding/finish'
import { usePostHog } from '@/lib/posthog/client'
import { FLOWS } from '@/lib/redesign/flows'
import {
  answeredIn,
  firstOpenRound,
  mergeAnswers,
  roundDone,
  roundQuestions,
  totalAnswered,
  type FlowDef,
  type RoundAnswers,
  type RoundSaveInput,
  type RoundSaveResult,
} from '@/lib/redesign/rounds'
import { cn } from '@/lib/utils'
import { NextQuestionCard } from './NextQuestionCard'
import { RoundQuestionField } from './RoundQuestionField'

type Phase = { kind: 'intro' } | { kind: 'round'; index: number } | { kind: 'finish' }

export interface RoundsFlowProps {
  flowId: FlowDef['id']
  /** What is already saved. Nothing in it is ever lost: a round only adds to it. */
  initialAnswers: RoundAnswers
  /** The member finished this once before (the long form or the rounds). */
  completed: boolean
  /** When it was finished before, for the retake line ("Oct 20, 2026"). Null if never. */
  completedOn?: string | null
  save: (input: RoundSaveInput) => Promise<RoundSaveResult>
  /** The finish screen's one optional question, or null once it is answered. */
  next: NextQuestion | null
  saveNext?: React.ComponentProps<typeof NextQuestionCard>['save']
  doneHref: string
  doneLabel: string
  /** When there is no optional question to ask, one place worth going next. */
  otherHref?: string
  otherLabel?: string
}

const storageKey = (flow: FlowDef) => `nc-rounds-${flow.id}`

function readLocal(flow: FlowDef): RoundAnswers {
  try {
    const raw = window.localStorage.getItem(storageKey(flow))
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as RoundAnswers) : {}
  } catch {
    return {}
  }
}

function writeLocal(flow: FlowDef, answers: RoundAnswers | null) {
  try {
    if (answers === null) window.localStorage.removeItem(storageKey(flow))
    else window.localStorage.setItem(storageKey(flow), JSON.stringify(answers))
  } catch {
    // Private windows can block storage; the answers still live on the page and in the saved rounds.
  }
}

function startPhase(flow: FlowDef, answers: RoundAnswers, completed: boolean): Phase {
  if (totalAnswered(flow, answers) === 0) return { kind: 'intro' }
  const open = firstOpenRound(flow, answers)
  if (open === -1 && completed) return { kind: 'finish' }
  return { kind: 'round', index: open === -1 ? flow.rounds.length - 1 : open }
}

// A long questionnaire as short rounds: at most three questions at a time, why we ask first, the payoff under them
// updating as each is answered, one primary action, a finish that says what was gained, and one optional next
// question. Each round is saved when it is done, so closing the page loses nothing; an error keeps every answer.
export function RoundsFlow({ flowId, initialAnswers, completed, completedOn, save, next, saveNext, doneHref, doneLabel, otherHref, otherLabel }: RoundsFlowProps) {
  const flow = FLOWS[flowId]
  const posthog = usePostHog()
  const [answers, setAnswers] = useState<RoundAnswers>(initialAnswers)
  const [phase, setPhase] = useState<Phase>(() => startPhase(flow, initialAnswers, completed))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const top = useRef<HTMLDivElement>(null)
  const resumed = totalAnswered(flow, initialAnswers) > 0

  // Answers kept in this browser from a round that could not be saved come back, and what is saved always wins.
  useEffect(() => {
    const local = readLocal(flow)
    if (Object.keys(local).length === 0) return
    const timer = setTimeout(() => setAnswers((a) => mergeAnswers(local, a)), 0)
    return () => clearTimeout(timer)
  }, [flow])

  const phaseKey = phase.kind === 'round' ? `round-${phase.index}` : phase.kind
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [phaseKey])

  const finish = flow.finish(answers)
  useEffect(() => {
    if (phase.kind !== 'finish') return
    posthog.capture(`${flow.eventPrefix}_finished`, { flow: flow.id, answered: totalAnswered(flow, answers), open: finish.open, pct: finish.pct, rounds: flow.rounds.length })
    // Once per arrival on the finish screen, not on every answer change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind])

  const setAnswer = (id: string, values: string[]) =>
    setAnswers((a) => {
      const nextAnswers = { ...a }
      if (values.length === 0) delete nextAnswers[id]
      else nextAnswers[id] = values
      writeLocal(flow, nextAnswers)
      return nextAnswers
    })

  function go(p: Phase) {
    setError(null)
    setPhase(p)
  }

  function submitRound(index: number) {
    const round = flow.rounds[index]
    const counts = answeredIn(flow, round, answers)
    const isLast = index === flow.rounds.length - 1
    const event = { flow: flow.id, round: index + 1, roundId: round.id, rounds: flow.rounds.length, answered: counts.answered, skipped: counts.skipped }
    // Nothing answered and not the last round: there is nothing to save, so just move on.
    if (counts.answered === 0 && !isLast) {
      posthog.capture(`${flow.eventPrefix}_round_completed`, event)
      go({ kind: 'round', index: index + 1 })
      return
    }
    setError(null)
    const mine: RoundAnswers = Object.fromEntries(round.questionIds.filter((id) => answers[id]).map((id) => [id, answers[id]]))
    startTransition(async () => {
      let result: RoundSaveResult
      try {
        result = await save({ roundId: round.id, answers: mine, allAnswers: answers, final: isLast })
      } catch {
        result = { ok: false, error: 'We could not reach the server. Your answers are still here: check your connection and try again.' }
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
      posthog.capture(`${flow.eventPrefix}_round_completed`, event)
      setAnswers((a) => mergeAnswers(result.answers, a))
      if (result.completed) writeLocal(flow, null)
      go(isLast ? { kind: 'finish' } : { kind: 'round', index: index + 1 })
    })
  }

  const minutes = Math.max(1, Math.round((flow.rounds.length * flow.secondsPerRound) / 60))
  const doneCount = flow.rounds.filter((r) => roundDone(flow, r, answers)).length

  return (
    <div ref={top} className={cn('scroll-mt-6 space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}>
      {phase.kind === 'intro' && (
        <Intro
          flow={flow}
          answers={answers}
          minutes={minutes}
          completedOn={completedOn}
          resumed={resumed}
          onStart={() => {
            posthog.capture(`${flow.eventPrefix}_started`, { flow: flow.id, rounds: flow.rounds.length, retake: !!completedOn })
            go({ kind: 'round', index: Math.max(0, firstOpenRound(flow, answers)) })
          }}
        />
      )}

      {phase.kind === 'round' && (
        <RoundView
          flow={flow}
          index={phase.index}
          answers={answers}
          doneCount={doneCount}
          pending={pending}
          error={error}
          resumedNote={resumed && phase.index > 0 && phase.index === firstOpenRound(flow, initialAnswers)}
          onAnswer={setAnswer}
          onContinue={() => submitRound(phase.index)}
          onBack={() => go(phase.index === 0 ? { kind: 'intro' } : { kind: 'round', index: phase.index - 1 })}
        />
      )}

      {phase.kind === 'finish' && (
        <Finish
          flow={flow}
          finish={finish}
          next={next}
          saveNext={saveNext}
          doneHref={doneHref}
          doneLabel={doneLabel}
          otherHref={otherHref}
          otherLabel={otherLabel}
          onPickUp={() => go({ kind: 'round', index: Math.max(0, firstOpenRound(flow, answers)) })}
          onReview={() => go({ kind: 'round', index: 0 })}
          onNextAnswered={(questionId) => posthog.capture(`${flow.eventPrefix}_next_question_answered`, { flow: flow.id, questionId })}
          onOtherClicked={() => posthog.capture(`${flow.eventPrefix}_next_step_clicked`, { flow: flow.id, destination: otherHref })}
        />
      )}
    </div>
  )
}

function Intro({ flow, answers, minutes, completedOn, resumed, onStart }: { flow: FlowDef; answers: RoundAnswers; minutes: number; completedOn?: string | null; resumed: boolean; onStart: () => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{flow.rounds.length} short rounds · about {minutes} {minutes === 1 ? 'minute' : 'minutes'} in all</p>
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink"><span className="font-semibold">Why we ask:</span> {flow.why}</p>
        <p className="text-base text-ink"><span className="font-semibold">What you get:</span> {flow.gets}</p>
        <p className="text-sm text-muted-foreground">
          {completedOn ? `You finished this on ${completedOn}. Retake it any time; your last result stays until you finish again. ` : ''}
          Stop after any round and pick up later. Nothing is lost.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <PrimaryAction type="button" onClick={onStart}>{completedOn ? 'Retake in short rounds' : resumed ? 'Pick up where you left off' : 'Start round 1'}</PrimaryAction>
      </div>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">See all {flow.rounds.length} rounds</summary>
        <ol className="mt-3 space-y-1.5">
          {flow.rounds.map((r, i) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm text-ink">
              <span><span className="font-semibold">Round {i + 1}.</span> {r.title}</span>
              {roundDone(flow, r, answers) && <span className="font-medium text-success">Done</span>}
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}

function RoundView({ flow, index, answers, doneCount, pending, error, resumedNote, onAnswer, onContinue, onBack }: { flow: FlowDef; index: number; answers: RoundAnswers; doneCount: number; pending: boolean; error: string | null; resumedNote: boolean; onAnswer: (id: string, values: string[]) => void; onContinue: () => void; onBack: () => void }) {
  const round = flow.rounds[index]
  const questions = roundQuestions(flow, round)
  const counts = answeredIn(flow, round, answers)
  const isLast = index === flow.rounds.length - 1
  const payoff = useMemo(() => flow.payoff(answers, round), [flow, answers, round])
  const seconds = flow.secondsPerRound
  const reason = counts.answered === 0 ? 'Answer at least one question to save this round, or skip it.' : null

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">Round {index + 1} of {flow.rounds.length}</span>
          <span className="text-muted-foreground">About {seconds} seconds</span>
        </div>
        <Meter pct={Math.round((doneCount / flow.rounds.length) * 100)} label={`${doneCount} of ${flow.rounds.length} rounds done`} />
        {resumedNote && <p className="text-sm text-muted-foreground">Welcome back. {doneCount} of {flow.rounds.length} rounds are saved.</p>}
      </div>

      <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink"><span className="font-semibold">Why we ask:</span> {round.why}</p>

      <div className="space-y-6">
        <h2 className="font-display text-2xl leading-tight font-semibold text-ink">{round.title}</h2>
        {questions.map((q) => (
          <RoundQuestionField key={q.id} q={q} answers={answers} onChange={(values) => onAnswer(q.id, values)} />
        ))}
      </div>

      <PayoffPanel payoff={{ kind: 'resume', ...payoff }} />

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <PrimaryAction type="button" onClick={onContinue} pending={pending} pendingLabel="Saving…" disabledReason={reason}>
            {isLast ? 'Save and see what you gained' : 'Save and continue'}
          </PrimaryAction>
          <div className="flex items-center gap-5 pt-2.5 text-sm font-medium">
            <button type="button" onClick={onBack} disabled={pending} className="cursor-pointer text-brand underline underline-offset-4">Back</button>
            {counts.answered === 0 && (
              <button type="button" onClick={onContinue} disabled={pending} className="cursor-pointer text-brand underline underline-offset-4">{isLast ? 'Skip and finish' : 'Skip this round'}</button>
            )}
          </div>
        </div>
        {counts.answered > 0 && counts.skipped > 0 && <p className="text-sm text-muted-foreground">{counts.skipped} {counts.skipped === 1 ? 'question stays' : 'questions stay'} open. You can come back to {counts.skipped === 1 ? 'it' : 'them'}.</p>}
      </div>
    </div>
  )
}

function Finish({ flow, finish, next, saveNext, doneHref, doneLabel, otherHref, otherLabel, onPickUp, onReview, onNextAnswered, onOtherClicked }: { flow: FlowDef; finish: ReturnType<FlowDef['finish']>; next: NextQuestion | null; saveNext?: RoundsFlowProps['saveNext']; doneHref: string; doneLabel: string; otherHref?: string; otherLabel?: string; onPickUp: () => void; onReview: () => void; onNextAnswered: (questionId: string) => void; onOtherClicked: () => void }) {
  const complete = finish.open === 0
  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-2xl bg-ink p-8 text-white">
        <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">{complete ? `${flow.title} done` : `${flow.title}: ${finish.pct}% answered`}</p>
        <h2 className="font-display text-3xl leading-tight font-semibold">{finish.headline}</h2>
        {finish.gains.length > 0 && (
          <ul className="space-y-2.5 text-base text-white/90">
            {finish.gains.map((g) => (
              <li key={g.title} className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0" aria-hidden />
                <span><span className="font-semibold text-white">{g.title}.</span> {g.detail} <span className="text-white/60">({g.place})</span></span>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm"><span>{flow.questions.length - finish.open} of {flow.questions.length} answered</span><span className="font-semibold">{finish.pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20" role="meter" aria-valuenow={finish.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${flow.title} answered`}><div className="h-full rounded-full bg-action" style={{ width: `${finish.pct}%` }} /></div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {complete ? <PrimaryLink href={doneHref}>{doneLabel}</PrimaryLink> : <PrimaryAction type="button" onClick={onPickUp}>Pick up where you left off</PrimaryAction>}
        <div className="flex items-center gap-5 text-sm font-medium">
          {!complete && <Link href={doneHref} className="text-brand underline underline-offset-4">{doneLabel}</Link>}
          <button type="button" onClick={onReview} className="cursor-pointer text-brand underline underline-offset-4">Change an answer</button>
        </div>
      </div>

      {complete && next && <NextQuestionCard question={next} save={saveNext} onAnswered={(id) => onNextAnswered(id)} />}
      {complete && !next && otherHref && otherLabel && (
        <p className="text-sm text-muted-foreground">
          One more, if you like:{' '}
          <Link href={otherHref} onClick={onOtherClicked} className="font-medium text-brand underline underline-offset-4">{otherLabel}</Link>
        </p>
      )}
    </div>
  )
}
