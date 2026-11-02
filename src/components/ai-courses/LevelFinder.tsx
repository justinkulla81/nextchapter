'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { saveCoursePath, type CoursePathState } from '@/lib/leads/course-path-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { CATALOG_FUNCTIONS, LEVEL_QUESTIONS, catalogFunctionBySlug, functionLevelPath, hubPath, levelFromAnswers, levelInfo, levelPath } from '@/lib/learning/public-catalog-shared'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'

/**
 * "Find your AI level": four plain questions about what the person already does, then their function, then the courses for both.
 * The courses link is the primary action and needs no email; the email box is the quieter second step. Saves a HomepageLead of
 * kind course_path (src/lib/leads/course-path-actions.ts).
 */
export function LevelFinder({ source, defaultFunction = '' }: { source: string; defaultFunction?: string }) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [fn, setFn] = useState(defaultFunction)
  const [signup, action, pending] = useActionState<CoursePathState, FormData>(saveCoursePath, {})
  const done = LEVEL_QUESTIONS.every((q) => answers[q.id] !== undefined)
  const level = done ? levelInfo(levelFromAnswers(answers)) : null
  const fnInfo = catalogFunctionBySlug(fn)
  const href = level ? (fnInfo ? functionLevelPath(fnInfo, level) : levelPath(level)) : hubPath()

  const answer = (id: string, yes: boolean) => {
    const next = { ...answers, [id]: yes }
    setAnswers((prev) => ({ ...prev, [id]: yes }))
    posthog.capture('ai_level_quiz_answered', { source, question: id, answer: yes })
    if (LEVEL_QUESTIONS.every((q) => next[q.id] !== undefined)) {
      posthog.capture('ai_level_quiz_completed', { source, level: levelFromAnswers(next), function: fn || null })
    }
  }

  return (
    <section aria-labelledby={`level-finder-${source}`} className="rounded-xl border border-border bg-white p-6">
      <h2 id={`level-finder-${source}`} className="text-xl font-semibold tracking-tight text-navy">Find your AI level</h2>
      <p className="mt-1 text-sm text-muted-foreground">Four questions about what you already do. It takes under a minute and shows the courses that fit.</p>
      <ol className="mt-4 space-y-4">
        {LEVEL_QUESTIONS.map((q, i) => (
          <li key={q.id}>
            <p className="text-sm font-medium text-navy" id={`q-${source}-${q.id}`}>{i + 1}. {q.text}</p>
            <div role="group" aria-labelledby={`q-${source}-${q.id}`} className="mt-2 flex gap-2">
              {[{ label: 'Yes', value: true }, { label: 'Not yet', value: false }].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={answers[q.id] === o.value}
                  onClick={() => answer(q.id, o.value)}
                  className={cn('h-10 rounded-full border px-5 text-sm font-medium', answers[q.id] === o.value ? 'border-navy bg-navy text-white' : 'border-border bg-white text-foreground hover:bg-off-white')}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {level && (
        <div className="mt-6 border-t border-border pt-5" role="status">
          <p className="text-sm text-muted-foreground">Your level</p>
          <p className="text-2xl font-bold tracking-tight text-navy">{level.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{level.who}</p>
          <label className="mt-4 block text-sm font-medium text-navy">
            Your function
            <select value={fn} onChange={(e) => setFn(e.target.value)} className={FIELD}>
              <option value="">Any function</option>
              {CATALOG_FUNCTIONS.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
            </select>
          </label>
          <Link
            href={href}
            onClick={() => posthog.capture('course_path_link_clicked', { source, level: level.slug, function: fn || null })}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95"
          >
            Show my {level.label.toLowerCase()} courses{fnInfo ? ` for ${fnInfo.people}` : ''}
          </Link>

          {signup?.saved ? (
            <p className="mt-5 text-sm text-muted-foreground" role="status">
              {signup.confirmEmailed
                ? <>Check your inbox{signup.email ? <> at <span className="font-medium text-foreground">{signup.email}</span></> : ''} for your course path.</>
                : <>Saved{signup.email ? <> for <span className="font-medium text-foreground">{signup.email}</span></> : ''}. Course path emails are turning on soon, so use the button above for now.</>}
            </p>
          ) : (
            <form
              action={action}
              noValidate
              className={cn('mt-5', pending && 'cursor-wait')}
              onSubmit={() => posthog.capture('course_path_email_submitted_client', { source, level: level.slug, function: fn || null })}
            >
              <input type="hidden" name="source" value={source} />
              <input type="hidden" name="level" value={level.slug} />
              <input type="hidden" name="function" value={fn} />
              <div className="hidden" aria-hidden>
                <label htmlFor={`cp-website-${source}`}>Website</label>
                <input id={`cp-website-${source}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <p className="text-sm font-medium text-navy">Or get it by email</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor={`cp-email-${source}`}>Email address</label>
                <input id={`cp-email-${source}`} name="email" type="email" inputMode="email" autoComplete="email" defaultValue={signup?.email} placeholder="you@example.com" className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base" />
                <Button type="submit" variant="outline" disabled={pending || !fnInfo} className="h-11 rounded-full px-5">
                  {pending ? 'Saving…' : 'Email me my course path'}
                </Button>
              </div>
              {!fnInfo && <p className="mt-2 text-xs text-muted-foreground">Pick your function above to get an email path.</p>}
              {signup?.error && <p role="alert" className="mt-2 text-sm text-destructive">{signup.error}</p>}
            </form>
          )}
        </div>
      )}
    </section>
  )
}

