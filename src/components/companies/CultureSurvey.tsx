'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { CULTURE_DIMENSIONS, CULTURE_DIMENSION_BY_KEY, CULTURE_MIN_RESPONDENTS, CULTURE_PREF_DIMENSIONS, type CultureAnswers, type CultureDimensionKey } from '@/lib/companies/culture-survey'
import type { CultureProfile } from '@/lib/companies/culture-aggregate'
import { submitCultureSurvey, saveCulturePreferences } from '@/app/dashboard/companies/culture-actions'

// The insider culture survey (people who worked at a company describe it), the member's
// own culture preferences, and the aggregate bars on a company page. Structured, one tap
// per question; see src/lib/companies/culture-survey.ts for the questions and scales.

type Source = 'dashboard' | 'company_page'

const countAnswered = (a: CultureAnswers) => Object.values(a).filter((v) => v !== null && v !== undefined).length

/** The 8 questions with 3 adjacent buttons each. Skipping a question is fine. */
export function CultureSurveyForm({
  companyId,
  companyName,
  companySlug,
  initial,
  source,
  onSaved,
}: {
  companyId: string
  companyName: string
  companySlug: string
  initial: CultureAnswers | null
  source: Source
  onSaved?: () => void
}) {
  const [answers, setAnswers] = useState<CultureAnswers>(initial ?? {})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const answered = countAnswered(answers)

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await submitCultureSurvey(companyId, answers, companySlug)
      if (!result.ok) return setError(result.error)
      posthog.capture('culture_survey_submitted', {
        companyId,
        answeredCount: result.answeredCount,
        isCurrent: result.isCurrent ?? null,
        source,
        edited: initial !== null,
      })
      setSaved(true)
      onSaved?.()
    })
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')} aria-busy={pending}>
      {CULTURE_DIMENSIONS.map((d) => (
        <fieldset key={d.key} className="space-y-1.5">
          <legend className="text-sm font-medium text-foreground">{d.question}</legend>
          <ChoiceButtons
            name={`culture-${d.key}`}
            options={d.options.map((label, i) => ({ value: String(i + 1), label }))}
            value={answers[d.key] ? String(answers[d.key]) : null}
            compact
            onChange={(v) => setAnswers((a) => ({ ...a, [d.key]: Number(v) }))}
          />
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">
        Anonymous. Your answers are only ever shown combined with at least {CULTURE_MIN_RESPONDENTS - 1} other people&apos;s, never with
        your name, and never on their own. Skip anything you&apos;d rather not answer.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending || answered === 0} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save answers'}
        </Button>
        {answered === 0 && <span className="text-xs text-muted-foreground">Answer at least one question to save.</span>}
        {saved && <span className="text-sm text-success">Saved — thank you. This helps members deciding whether to apply to {companyName}.</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

const DISMISS_KEY = 'culture-survey-dismissed'
function readDismissed(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}
const DISMISS_DAYS = 14
const isRecentlyDismissed = (companyId: string) => {
  const at = readDismissed()[companyId]
  return !!at && Date.now() - at < DISMISS_DAYS * 86_400_000
}
const noopSubscribe = () => () => {}

/** Dashboard card: "You worked at X — 30 seconds to help others". */
export function CultureSurveyPromptCard({
  company,
  moreCount,
}: {
  company: { companyId: string; companyName: string; slug: string; isCurrent: boolean }
  moreCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dismissedNow, setHidden] = useState(false)
  // Dismissed on an earlier visit (browser storage; false during server render).
  const dismissedBefore = useSyncExternalStore(
    noopSubscribe,
    () => isRecentlyDismissed(company.companyId),
    () => false
  )
  const hidden = dismissedNow || dismissedBefore
  const shown = useRef(false)

  useEffect(() => {
    if (isRecentlyDismissed(company.companyId) || shown.current) return
    shown.current = true
    posthog.capture('culture_survey_prompt_shown', { companyId: company.companyId, source: 'dashboard', isCurrent: company.isCurrent, moreCount })
  }, [company.companyId, company.isCurrent, moreCount])

  if (hidden) return null

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify({ ...readDismissed(), [company.companyId]: Date.now() }))
    } catch {
      // storage blocked — hide for this visit only
    }
    posthog.capture('culture_survey_prompt_dismissed', { companyId: company.companyId, source: 'dashboard' })
    setHidden(true)
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          You {company.isCurrent ? 'work' : 'worked'} at {company.companyName} — 30 seconds to help others
        </p>
        <p className="text-sm text-muted-foreground">
          Eight one-tap questions about pace, decisions, balance and growth. Members weighing a job there see the combined answers of
          everyone who worked there — never yours on its own.
        </p>
      </div>
      {open ? (
        <CultureSurveyForm
          companyId={company.companyId}
          companyName={company.companyName}
          companySlug={company.slug}
          initial={null}
          source="dashboard"
          onSaved={() => setTimeout(() => router.refresh(), 1500)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setOpen(true)
              posthog.capture('culture_survey_opened', { companyId: company.companyId, source: 'dashboard' })
            }}
          >
            Describe {company.companyName}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          {moreCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {moreCount} more {moreCount === 1 ? 'company' : 'companies'} from your work history after this one
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Company page: the viewer's own answers, collapsed behind a button. */
export function CultureSurveyOwnEntry({
  companyId,
  companyName,
  companySlug,
  initial,
  isCurrent,
}: {
  companyId: string
  companyName: string
  companySlug: string
  initial: CultureAnswers | null
  isCurrent: boolean
}) {
  const [open, setOpen] = useState(false)
  const shown = useRef(false)
  useEffect(() => {
    if (initial || shown.current) return
    shown.current = true
    posthog.capture('culture_survey_prompt_shown', { companyId, source: 'company_page', isCurrent })
  }, [companyId, initial, isCurrent])

  if (open)
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium text-foreground">Your view of {companyName}</p>
        <CultureSurveyForm companyId={companyId} companyName={companyName} companySlug={companySlug} initial={initial} source="company_page" />
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
      <p className="text-sm text-muted-foreground">
        {initial ? 'You described this company. Your answers count toward the summary, never on their own.' : `You ${isCurrent ? 'work' : 'worked'} here — add your view in 30 seconds.`}
      </p>
      <Button
        size="sm"
        variant={initial ? 'outline' : 'default'}
        onClick={() => {
          setOpen(true)
          posthog.capture('culture_survey_opened', { companyId, source: 'company_page', edit: !!initial })
        }}
      >
        {initial ? 'Edit your answers' : 'Describe this company'}
      </Button>
    </div>
  )
}

// Ordered scale: three steps of the text color, not the accent (not actionable).
const SHARE_STYLE = ['bg-foreground/20', 'bg-foreground/45', 'bg-foreground/75']

/** Aggregate bars, or "Not enough responses yet — N of 3". */
export function CultureProfileBars({ profile }: { profile: CultureProfile }) {
  const logged = useRef(false)
  useEffect(() => {
    if (logged.current) return
    logged.current = true
    posthog.capture('company_culture_viewed', { companyId: profile.companyId, respondentCount: profile.respondentCount, shown: profile.shown })
  }, [profile.companyId, profile.respondentCount, profile.shown])

  if (!profile.shown) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough responses yet — {Math.min(profile.respondentCount, CULTURE_MIN_RESPONDENTS - 1)} of {CULTURE_MIN_RESPONDENTS}. We show this
        once at least {CULTURE_MIN_RESPONDENTS} members who worked here have answered, so no one&apos;s answers can be picked out.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        From {profile.respondentCount} members who worked here. Combined answers only — never who said what.
      </p>
      <dl className="space-y-3">
        {profile.dimensions.map((agg) => {
          const d = CULTURE_DIMENSION_BY_KEY[agg.key as CultureDimensionKey]
          return (
            <div key={agg.key} className="space-y-1">
              <dt className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className="text-xs text-muted-foreground">{agg.typical ? `Most say: ${d.options[agg.typical - 1].toLowerCase()}` : 'Mixed views'}</span>
              </dt>
              <dd>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {agg.shares.map((s, i) => (s > 0 ? <div key={i} className={SHARE_STYLE[i]} style={{ width: `${s}%` }} /> : null))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{d.options.map((o, i) => `${o} ${agg.shares[i]}%`).join(' · ')}</p>
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/** Search Strategy: what the member wants, on the same dimensions. */
export function CulturePreferencesForm({ initial }: { initial: CultureAnswers | null }) {
  const [prefs, setPrefs] = useState<CultureAnswers>(initial ?? {})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const answered = countAnswered(prefs)

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveCulturePreferences(prefs)
      if (!result.ok) return setError(result.error)
      posthog.capture('culture_preferences_saved', {
        answeredCount: result.answeredCount,
        noPreferenceCount: Object.values(prefs).filter((v) => v === 0).length,
        firstSave: initial === null,
      })
      setSaved(true)
    })
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')} aria-busy={pending}>
      {CULTURE_PREF_DIMENSIONS.map((d) => (
        <fieldset key={d.key} className="space-y-1.5">
          <legend className="text-sm font-medium text-foreground">{d.prefQuestion}</legend>
          <ChoiceButtons
            name={`culture-pref-${d.key}`}
            responsive
            columns={4}
            options={[...d.prefOptions!.map((label, i) => ({ value: String(i + 1), label })), { value: '0', label: 'No preference' }]}
            value={prefs[d.key] !== null && prefs[d.key] !== undefined ? String(prefs[d.key]) : null}
            onChange={(v) => setPrefs((p) => ({ ...p, [d.key]: Number(v) }))}
          />
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">
        Where you want to work (remote, hybrid or on-site) comes from your target role answers above. We compare these with what members
        who worked at a company say about it, on each job&apos;s match.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending || answered === 0} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
          {pending ? 'Saving…' : 'Save culture preferences'}
        </Button>
        {answered === 0 && <span className="text-xs text-muted-foreground">Pick at least one answer to save.</span>}
        {saved && <span className="text-sm text-success">Saved. Your job matches now use these.</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
