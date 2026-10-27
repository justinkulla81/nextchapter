'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlanStart } from '@/components/layoffs/PlanStart'
import { saveLayoffAlert, type LayoffAlertState } from '@/lib/leads/layoff-alert-actions'
import { posthog } from '@/lib/posthog/client'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { cn } from '@/lib/utils'
import {
  ROLE_FAMILIES,
  SIGNAL_LABEL,
  SIZE_BANDS,
  assessRisk,
  type EmployerFacts,
  type IndustryTrend,
  type RiskResult,
  type SizeBand,
} from '@/lib/layoff-risk/rules'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const SIGNAL_STYLE = {
  low: 'border-success/40 bg-success/5 text-foreground',
  watch: 'border-amber-400/60 bg-amber-50 text-foreground',
  high: 'border-destructive/40 bg-destructive/5 text-foreground',
} as const

/** "Email me if my employer files a new notice": the existing layoff alert signup, tagged with this tool. */
function RiskAlertBox({ employer }: { employer: EmployerFacts | null }) {
  const [state, action, pending] = useActionState<LayoffAlertState, FormData>(saveLayoffAlert, undefined)
  if (state?.saved) {
    return (
      <p role="status" className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
        {state.confirmEmailed ? (
          <>Check your inbox{state.email ? <> at <span className="font-medium">{state.email}</span></> : ''} and click the link to start.</>
        ) : (
          <>Saved{state.email ? <> for <span className="font-medium">{state.email}</span></> : ''}. Layoff emails are turning on soon, and this will be first in line.</>
        )}
      </p>
    )
  }
  return (
    <form
      action={action}
      noValidate
      className={cn('rounded-xl border border-border bg-white p-4', pending && 'cursor-wait')}
      onSubmit={() => posthog.capture('layoff_risk_email_submitted_client', { employer: employer?.slug ?? null })}
    >
      <p className="text-base font-semibold text-navy">{employer ? `Email me if ${employer.name} files a new notice` : 'Email me when a new notice is filed in my state'}</p>
      <p className="mt-1 text-sm text-muted-foreground">One email a day at most, only when there is something new. No account needed.</p>
      <input type="hidden" name="source" value="layoff_risk_check" />
      <input type="hidden" name="employer" value={employer?.slug ?? ''} />
      <div className="hidden" aria-hidden>
        <label htmlFor="risk-website">Website</label>
        <input id="risk-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {!employer && (
        <label className="mt-3 block text-sm font-medium text-navy">
          State
          <select name="state" defaultValue="" className={FIELD}>
            <option value="" disabled>Choose a state</option>
            {ALL_STATE_CODES.map((c) => (
              <option key={c} value={c}>{stateName(c)}</option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="risk-email">Email address</label>
        <input id="risk-email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state?.email} placeholder="you@example.com" aria-invalid={state?.error ? true : undefined} className="h-11 flex-1 rounded-lg border border-border bg-white px-3 text-base" />
        <Button type="submit" disabled={pending} className="h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
          {pending ? 'Saving…' : 'Email me'}
        </Button>
      </div>
      {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

/**
 * The layoff risk check. Four optional answers (employer, employer size, industry, kind of work), then a count of warning signs checked against
 * this site's own records, with each sign shown. It works out the result in the browser from the industry table the page passes in and the
 * employer facts one lookup returns; nothing is saved unless the person asks for the email. It says plainly that it is not a prediction.
 */
export function LayoffRiskCheck({ industries, asOf }: { industries: IndustryTrend[]; asOf: string }) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<EmployerFacts[]>([])
  const [employer, setEmployer] = useState<EmployerFacts | null>(null)
  const [size, setSize] = useState<SizeBand | null>(null)
  const [industry, setIndustry] = useState('')
  const [role, setRole] = useState('')
  const [result, setResult] = useState<RiskResult | null>(null)
  const [empty, setEmpty] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Employer search: a short delay after typing, one small request. Failures just leave the list empty.
  useEffect(() => {
    if (employer || query.trim().length < 2) return
    if (timer.current) clearTimeout(timer.current)
    const controller = new AbortController()
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/layoffs/employer-lookup?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        const json = (await res.json()) as { employers?: EmployerFacts[] }
        setMatches(json.employers ?? [])
      } catch {
        setMatches([])
      }
    }, 250)
    return () => {
      controller.abort()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, employer])

  const trend = useMemo(() => industries.find((i) => i.bucket === industry) ?? null, [industries, industry])
  const shown = employer || query.trim().length < 2 ? [] : matches

  function run() {
    if (!employer && !industry && !role) {
      setEmpty(true)
      setResult(null)
      return
    }
    setEmpty(false)
    const r = assessRisk({ employer, size, industry: trend, roleCode: role || null })
    setResult(r)
    posthog.capture('layoff_risk_checked', {
      signal: r.signal,
      signsThatApply: r.signs.filter((s) => s.applies).length,
      hasEmployer: !!employer,
      employer: employer?.slug ?? null,
      size,
      industry: industry || null,
      role: role || null,
    })
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm text-muted-foreground">Answer any of these, as few or as many as you like. Nothing is saved, and none of it leaves this page unless you ask for the email.</p>

        <div className="mt-4">
          <label htmlFor="risk-employer" className="block text-sm font-medium text-navy">Your employer</label>
          {employer ? (
            <p className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-border bg-off-white px-3 py-2 text-base">
              <span className="font-medium text-navy">{employer.name}</span>
              <button type="button" className="text-sm text-brand underline underline-offset-4" onClick={() => { setEmployer(null); setQuery(''); setMatches([]); setResult(null) }}>
                Change
              </button>
            </p>
          ) : (
            <>
              <input id="risk-employer" type="text" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder="Start typing a company name" className={FIELD} />
              {shown.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-white text-sm">
                  {shown.map((m) => (
                    <li key={m.slug}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          setEmployer(m)
                          setMatches([])
                          posthog.capture('layoff_risk_employer_selected', { employer: m.slug, recentNotices: m.recentNotices })
                        }}
                      >
                        <span className="font-medium text-navy">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.recentNotices > 0 ? `${m.recentNotices} notice${m.recentNotices === 1 ? '' : 's'} in 12 months` : m.announcedRecently ? 'announcement on file' : 'no notice on file'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && shown.length === 0 && matches.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">If your employer is not listed, it has no notice or announcement on our record. Leave this blank and answer the rest.</p>
              )}
            </>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-navy" id="risk-size-label">How many people work there?</p>
          <div role="group" aria-labelledby="risk-size-label" className="mt-1 flex flex-wrap gap-2">
            {SIZE_BANDS.map((b) => (
              <button
                key={b.key}
                type="button"
                aria-pressed={size === b.key}
                onClick={() => setSize(size === b.key ? null : b.key)}
                className={cn('h-11 rounded-full border px-4 text-sm font-medium', size === b.key ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink hover:bg-muted')}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-navy">
          Industry
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={FIELD}>
            <option value="">Choose an industry</option>
            {industries.map((i) => (
              <option key={i.bucket} value={i.bucket}>{i.bucket}</option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium text-navy">
          Kind of work
          <select value={role} onChange={(e) => setRole(e.target.value)} className={FIELD}>
            <option value="">Choose a kind of work</option>
            {ROLE_FAMILIES.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={run} className="h-12 rounded-full bg-action px-6 text-base text-action-foreground hover:brightness-95">
            Check my warning signs
          </Button>
          {empty && <span role="alert" className="text-sm text-destructive">Answer at least one question above to run the check.</span>}
        </div>
      </div>

      <div aria-live="polite">
        {result && (
          <div className="mt-8 space-y-6">
            <div className={cn('rounded-2xl border p-5', SIGNAL_STYLE[result.signal])}>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Warning-sign level</p>
              <p className="mt-1 text-3xl font-bold text-navy">{SIGNAL_LABEL[result.signal]}</p>
              <p className="mt-2 max-w-2xl text-base">{result.why}</p>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                This counts signs that can be checked against public records. It is not a prediction about you or your job, and it has not been tested against who was actually laid off.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-navy">The five checks</h3>
              <ul className="mt-3 space-y-2">
                {result.signs.map((s) => (
                  <li key={s.key} className="rounded-xl border border-border bg-white p-4 text-sm">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', s.applies ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground')}>{s.applies ? 'Applies' : 'Does not apply'}</span>
                      <span className="font-medium text-navy">{s.label}</span>
                    </p>
                    <p className="mt-1 text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Data as of {asOf}.</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-navy">What this cannot see</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {result.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5">
              <h3 className="text-lg font-semibold text-navy">Start your plan before you need it</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Whatever the level, the same preparation helps: know what the market pays for your work, what you would do in the first week, and who to call. A free account turns it into a plan.</p>
              <div className="mt-4"><PlanStart situationSlug="thinking-about-a-move" placement="risk_check_result" label="Get your free Market Reality Assessment" eventPrefix="layoff_risk" /></div>
            </div>

            <RiskAlertBox employer={employer} />
          </div>
        )}
      </div>
    </div>
  )
}
