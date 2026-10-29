'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Q1, Q2, Q3, type LandingVariant, type Q1Answer, type Q2Answer, type Q3Answer } from '@/lib/layoffs/landing'
import type { JourneyState } from '@/lib/leads/actions'

/** `id` is the College Scorecard unitid; `path` is the school's page on this site (null when it has none). */
export type School = { id: string; name: string; place: string; path: string | null }

const TONE = {
  sun: 'bg-tint-sun',
  mint: 'bg-tint-mint',
  sky: 'bg-tint-sky',
  plum: 'bg-tint-plum',
} as const

const H2 = 'text-2xl font-bold tracking-tight text-navy'

function Choice({ label, hint, pressed, onClick }: { label: string; hint: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-16 rounded-2xl border-[1.5px] px-4 py-3 text-left text-sm font-medium leading-snug transition-colors',
        pressed ? 'border-action bg-tint-sky text-brand' : 'border-border bg-off-white text-navy hover:border-brand',
      )}
    >
      {label}
      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>
    </button>
  )
}

/**
 * The three questions at the top of a company page: where you stand (the journey it starts and the email capture), what you want next
 * (with a college search that goes to that school's page), and what would help most. The answers ride along with the email as one lead.
 * `action` is the journey-lead server action; the preview passes a stand-in so nothing is sent.
 */
export function SituationFlow({ variant, company, slug, state, action, searchSchools, buyoutRule, source }: {
  variant: LandingVariant
  company: string
  slug: string
  state: string | null
  action: (prev: JourneyState, formData: FormData) => Promise<JourneyState>
  searchSchools: (q: string) => Promise<School[]>
  /** Which page the lead came from (see the allowed list in submitJourneyLead). Defaults to this company's layoff page. */
  source?: string
  /** What the company's state agency says about taking a buyout (src/lib/warn/buyout-unemployment.ts), when we have it. */
  buyoutRule?: { stateName: string; agency: string; text: string; url: string; checked: string } | null
}) {
  const answers = Q1[variant]
  const [q1, setQ1] = useState<Q1Answer | null>(null)
  const [q2, setQ2] = useState<Q2Answer | null>(null)
  const [q3, setQ3] = useState<Q3Answer[]>([])
  const [school, setSchool] = useState<School | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<School[] | null>(null)
  const [wantsCommunity, setWantsCommunity] = useState(true)
  const [formState, formAction, pending] = useActionState<JourneyState, FormData>(action, undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const props = { company: slug, variant, state }

  function pickQ1(a: Q1Answer) {
    setQ1(a)
    posthog.capture('company_page_q1_answered', { ...props, answer: a.key, persona: a.persona })
  }
  function pickQ2(a: Q2Answer) {
    setQ2(a)
    posthog.capture('company_page_q2_answered', { ...props, answer: a.key })
  }
  function toggleQ3(a: Q3Answer) {
    const on = !q3.some((x) => x.key === a.key)
    setQ3((cur) => (on ? [...cur, a] : cur.filter((x) => x.key !== a.key)))
    posthog.capture('company_page_q3_toggled', { ...props, answer: a.key, selected: on })
  }
  function typeSchool(v: string) {
    setQuery(v)
    setSchool(null)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 2) { setHits(null); return }
    timer.current = setTimeout(async () => setHits(await searchSchools(v.trim())), 200)
  }
  function pickSchool(s: School) {
    setSchool(s)
    setQuery(s.name)
    setHits(null)
    posthog.capture('company_page_school_picked', { ...props, schoolId: s.id })
  }

  const planParts = [q1?.label, q2?.label, ...q3.map((x) => x.title)].filter(Boolean)

  return (
    <section aria-labelledby="where-you-stand" className="space-y-6">
      <div className="space-y-4 rounded-3xl border border-border bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="where-you-stand" className={H2}>Where do you stand?</h2>
          <span className="rounded-full bg-tint-sun px-3 py-0.5 text-xs font-semibold text-tint-sun-ink">Question 1 of 3</span>
        </div>
        <div role="group" aria-label={`Where you stand with ${company}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {answers.map((a) => <Choice key={a.key} label={a.label} hint={a.hint} pressed={q1?.key === a.key} onClick={() => pickQ1(a)} />)}
        </div>

        {q1 && (
          <form
            action={formAction}
            noValidate
            className={cn('space-y-3 rounded-2xl p-5', TONE[q1.tone], pending && 'cursor-wait')}
            onSubmit={() => posthog.capture('company_page_email_submitted_client', { ...props, answer: q1.key, q2: q2?.key ?? null, q3: q3.map((x) => x.key), schoolId: school?.id ?? null })}
          >
            <h3 className="text-lg font-semibold text-navy">{q1.heading}</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {q1.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
            {q1.note && (
              <div className="space-y-2 rounded-xl bg-white p-3 text-sm">
                <p>{q1.note}</p>
                {buyoutRule && (
                  <p>
                    <span className="font-semibold">In {buyoutRule.stateName}:</span> the {buyoutRule.agency}. {buyoutRule.text}{' '}
                    <a href={buyoutRule.url} target="_blank" rel="noopener" className="underline underline-offset-4">Read it on their site</a>
                    <span className="text-muted-foreground"> (checked {buyoutRule.checked}; each claim is decided on its facts)</span>
                  </p>
                )}
              </div>
            )}

            <input type="hidden" name="situation" value={q1.persona} />
            <input type="hidden" name="source" value={source ?? `layoffs:guide:${slug}`} />
            <input type="hidden" name="answerKey" value={q1.key} />
            <input type="hidden" name="next" value={q2?.key ?? ''} />
            <input type="hidden" name="help" value={q3.map((x) => x.key).join(',')} />
            <input type="hidden" name="variant" value={variant} />
            <input type="hidden" name="schoolUnitid" value={school?.id ?? ''} />
            <input type="hidden" name="schoolName" value={school?.name ?? ''} />
            <input type="hidden" name="joinCommunity" value={school && wantsCommunity ? '1' : ''} />
            <div className="hidden" aria-hidden>
              <label htmlFor="landing-website">Website</label>
              <input id="landing-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            {formState?.done ? (
              <p role="status" className="rounded-xl bg-white p-3 text-sm font-medium text-success">
                {formState.capped
                  ? 'We saved your answers. Today’s plan emails are used up, so yours has not gone out.'
                  : `Your plan is on its way to ${formState.email}. If it is not there in a few minutes, check spam.`}
                {school?.path && <> <Link href={school.path} className="font-semibold underline underline-offset-4">See the {school.name} page</Link>.</>}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <label className="sr-only" htmlFor="landing-email">Email address</label>
                  <input id="landing-email" name="email" type="email" autoComplete="email" defaultValue={formState?.email ?? ''} placeholder="you@example.com" className="h-11 min-w-0 flex-1 basis-60 rounded-lg border border-border bg-white px-3 text-base" />
                  <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">
                    {pending ? 'Sending…' : q1.cta}
                  </Button>
                </div>
                {planParts.length > 1 && <p className="text-xs text-muted-foreground">Your plan will cover: {planParts.join(' · ')}.</p>}
                <p className="text-xs text-muted-foreground">Free. One plan email, and you can unsubscribe in one click.</p>
                {formState?.error && <p role="alert" className="text-sm text-destructive">{formState.error}</p>}
              </>
            )}
          </form>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={H2}>What do you want next?</h2>
          <span className="rounded-full bg-tint-sun px-3 py-0.5 text-xs font-semibold text-tint-sun-ink">Question 2 of 3</span>
        </div>
        <div role="group" aria-label="What you want next" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Q2.map((a) => <Choice key={a.key} label={a.label} hint={a.hint} pressed={q2?.key === a.key} onClick={() => pickQ2(a)} />)}
        </div>
        {q2 && (
          <div className={cn('space-y-3 rounded-2xl p-5', TONE[q2.tone])}>
            <h3 className="text-lg font-semibold text-navy">{q2.heading}</h3>
            <p className="text-sm">{q2.text}</p>
            {q2.key === 'school' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="landing-school" className="sr-only">College name</label>
                  <input id="landing-school" type="text" value={query} onChange={(e) => typeSchool(e.target.value)} autoComplete="off" placeholder="Start typing your college" className="h-11 w-full rounded-lg border border-border bg-white px-3 text-base" />
                  {hits && (
                    <ul className="mt-1 overflow-hidden rounded-lg border border-border bg-white text-sm">
                      {hits.length === 0 && <li className="px-3 py-2 text-muted-foreground">No match yet. Keep typing the full name.</li>}
                      {hits.map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => pickSchool(s)} className="block w-full px-3 py-2 text-left hover:bg-tint-sky">
                            {s.name} <span className="text-xs text-muted-foreground">{s.place}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {school && (
                  <div className="space-y-2 rounded-xl bg-white p-4 text-sm">
                    <p className="font-semibold text-navy">{school.name}</p>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={wantsCommunity} onChange={(e) => setWantsCommunity(e.target.checked)} className="mt-1" />
                      <span>Add me to the {school.name} alumni list. The plan email links to its page and says how the alumni network opens.</span>
                    </label>
                    {!q1 && <p className="text-xs text-muted-foreground">Answer question 1 to add your email.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={H2}>What would help most right now?</h2>
          <span className="rounded-full bg-tint-sun px-3 py-0.5 text-xs font-semibold text-tint-sun-ink">Question 3 of 3 · pick any</span>
        </div>
        <div role="group" aria-label="What would help most" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Q3.map((a) => <Choice key={a.key} label={a.label} hint={a.hint} pressed={q3.some((x) => x.key === a.key)} onClick={() => toggleQ3(a)} />)}
        </div>
        {q3.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-tint-plum p-5">
            <h3 className="text-lg font-semibold text-navy">Here is what goes in your plan</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {q3.map((x) => <li key={x.key}><span className="font-semibold">{x.title}.</span> {x.text}</li>)}
            </ul>
            {!q1 && <p className="text-xs text-muted-foreground">Answer question 1 to add your email.</p>}
          </div>
        )}
      </div>
    </section>
  )
}
