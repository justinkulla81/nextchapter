'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { searchLayoffCompanies, submitStoryAction, type CompanyHit, type StoryFormState } from '@/app/layoffs/stories/actions'
import { FOUND_OUT, FUNCTIONS, HELP, LEVELS, NOTICE_GIVEN, SEVERANCE, SIGNED_RELEASE, STORY_MAX, TENURES, WARN_NOTICE, WHERE_NOW, type Option } from '@/lib/layoff-stories/rules'

const FIELD = 'mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-base'
const LABEL = 'block text-sm font-medium text-navy'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 2 to 4 choices as adjacent buttons (a radio group underneath, so the keyboard and screen readers work). */
function Choice({ name, legend, options, value, onChange }: { name: string; legend: string; options: Option[]; value?: string; onChange?: (v: string) => void }) {
  return (
    <fieldset className="mt-4">
      <legend className={LABEL}>{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.key} className="cursor-pointer">
            <input type="radio" name={name} value={o.key} defaultChecked={value === o.key} onChange={() => onChange?.(o.key)} className="peer sr-only" />
            <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-white px-4 text-sm text-navy peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Select({ name, legend, options, value, placeholder }: { name: string; legend: string; options: Option[]; value?: string; placeholder: string }) {
  return (
    <label className={`${LABEL} mt-4`}>
      {legend}
      <select name={name} defaultValue={value ?? ''} className={FIELD}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  )
}

export interface StoryFormProps {
  prefill: { slug: string; name: string; month: string } | null
  source: string
  publishOpen: boolean
  years: number[]
}

/** The layoff story form: three short steps. Only the first is required. Private is the default. */
export function StoryForm({ prefill, source, publishOpen, years }: StoryFormProps) {
  const posthog = usePostHog()
  const [state, action] = useActionState<StoryFormState, FormData>(submitStoryAction, undefined)
  const v = state?.values
  const str = (k: string, d = '') => (typeof v?.[k] === 'string' ? (v[k] as string) : d)
  const [step, setStep] = useState(1)
  const [company, setCompany] = useState({ slug: str('companySlug', prefill?.slug ?? ''), name: str('companyName', prefill?.name ?? '') })
  const [hits, setHits] = useState<CompanyHit[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [visibility, setVisibility] = useState(str('visibility', 'PRIVATE'))
  const [month, setMonth] = useState(() => { const m = str('toldMonth', prefill?.month ?? ''); return { y: m.slice(0, 4), m: m.slice(5, 7) } })
  const [fn, setFn] = useState(str('fn'))
  const [title, setTitle] = useState(str('title'))
  const [level, setLevel] = useState(str('level'))
  const [len, setLen] = useState(str('body').length)
  const [stepError, setStepError] = useState('')
  const seq = useRef(0)

  useEffect(() => { posthog?.capture('layoff_story_form_viewed', { source, companySlug: prefill?.slug ?? null, prefilled: !!prefill }) }, [posthog, source, prefill])

  useEffect(() => {
    if (!listOpen) return
    const mine = ++seq.current
    const t = setTimeout(async () => { const r = await searchLayoffCompanies(company.name); if (mine === seq.current) setHits(r) }, 200)
    return () => clearTimeout(t)
  }, [company.name, listOpen])

  function next() {
    const missing = !company.name.trim() ? 'Choose your company, or type its name.' : !month.y || !month.m ? 'Choose the month you were told.' : !fn ? 'Choose your function.' : title.trim().length < 2 ? 'Enter your job title.' : !level ? 'Choose your level.' : ''
    setStepError(missing)
    if (missing) return
    posthog?.capture('layoff_story_step_completed', { step, companySlug: company.slug || null, listed: !!company.slug })
    setStep(step + 1)
  }

  if (state?.sent) {
    return (
      <div role="status" className="max-w-xl rounded-xl border border-border bg-white p-6 text-sm">
        <p className="text-lg font-semibold text-navy">Thank you.</p>
        {state.sent.failed ? (
          <p className="mt-2 text-muted-foreground">We saved your answers but could not send the confirmation email. They are not counted in the company numbers until you confirm. Nothing from you is shown.</p>
        ) : state.sent.email ? (
          <p className="mt-2 text-muted-foreground">We sent a confirmation link to {state.sent.email}. Confirm it so your answers count in the numbers for {company.name}.{visibility !== 'PRIVATE' ? ' A person on our team reads a story before it is shown, and your email is never shown.' : ' Nothing from you is shown.'}</p>
        ) : (
          <p className="mt-2 text-muted-foreground">We saved your answers. Without a confirmed email they are not counted in the company numbers. Nothing from you is shown.</p>
        )}
      </div>
    )
  }

  const years_ = years
  return (
    <form action={action} className="max-w-xl rounded-xl border border-border bg-white p-6" noValidate onChange={() => { if (stepError) setStepError('') }}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="companySlug" value={company.slug} />
      <input type="hidden" name="toldMonth" value={month.y && month.m ? `${month.y}-${month.m}` : ''} />
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground" aria-live="polite">Step {step} of 3</p>

      <div hidden={step !== 1}>
        <h2 className="mt-1 text-lg font-semibold text-navy">What happened to you</h2>
        <div className="relative mt-4">
          <label className={LABEL}>
            Company
            <input name="companyName" value={company.name} autoComplete="off" onFocus={() => setListOpen(true)} onBlur={() => setTimeout(() => setListOpen(false), 150)} onChange={(e) => setCompany({ slug: '', name: e.target.value })} className={FIELD} />
          </label>
          {listOpen && hits.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white py-1 shadow-sm">
              {hits.map((h) => (
                <li key={h.slug}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCompany({ slug: h.slug, name: h.name }); setListOpen(false) }} className="block min-h-11 w-full px-3 text-left text-sm hover:bg-off-white">{h.name}</button></li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{company.slug ? 'Matched to a company we track.' : 'Pick from the list, or type your company if it is not there.'}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className={LABEL}>Month you were told
            <select value={month.m} onChange={(e) => setMonth({ ...month, m: e.target.value })} className={FIELD}><option value="">Month</option>{MONTHS.map((n, i) => <option key={n} value={String(i + 1).padStart(2, '0')}>{n}</option>)}</select>
          </label>
          <label className={LABEL}><span className="invisible">Year</span>
            <select value={month.y} onChange={(e) => setMonth({ ...month, y: e.target.value })} aria-label="Year" className={FIELD}><option value="">Year</option>{years_.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </label>
        </div>
        <label className={`${LABEL} mt-4`}>Function
          <select name="fn" value={fn} onChange={(e) => setFn(e.target.value)} className={FIELD}><option value="">Choose one</option>{FUNCTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
        </label>
        <label className={`${LABEL} mt-4`}>Job title
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="organization-title" className={FIELD} />
        </label>
        <Choice name="level" legend="Level" options={LEVELS} value={level} onChange={setLevel} />
      </div>

      <div hidden={step !== 2}>
        <h2 className="mt-1 text-lg font-semibold text-navy">How it went</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every question here is optional. Skip what you do not remember.</p>
        <Choice name="tenure" legend="How long were you there?" options={TENURES} value={str('tenure')} />
        <Select name="foundOut" legend="How did you find out?" options={FOUND_OUT} value={str('foundOut')} placeholder="Choose one" />
        <Choice name="noticeGiven" legend="How much notice did you get?" options={NOTICE_GIVEN} value={str('noticeGiven')} />
        <Choice name="warnNotice" legend="Did you get a written WARN notice?" options={WARN_NOTICE} value={str('warnNotice')} />
        <Select name="severance" legend="Severance" options={SEVERANCE} value={str('severance')} placeholder="Choose one" />
        <Choice name="signedRelease" legend="Did you sign a release to get it?" options={SIGNED_RELEASE} value={str('signedRelease')} />
        <Choice name="whereNow" legend="Where are you now?" options={WHERE_NOW} value={str('whereNow')} />
      </div>

      <div hidden={step !== 3}>
        <h2 className="mt-1 text-lg font-semibold text-navy">Your story</h2>
        <label className={`${LABEL} mt-3`}>
          In your own words (optional)
          <textarea name="body" rows={6} defaultValue={str('body')} onChange={(e) => setLen(e.target.value.length)} maxLength={STORY_MAX + 200} className="mt-1 w-full rounded-lg border border-border bg-white p-3 text-base" />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{len} of {STORY_MAX} characters. What happened, what the company did well or badly, and what you wish you had known. Stick to what happened to you: no names of coworkers or managers, no confidential material, no links. If you signed a severance agreement, check it for a clause about what you may say.</span>
        </label>
        <fieldset className="mt-4">
          <legend className={LABEL}>What would have helped? (optional)</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {HELP.map((o) => (
              <label key={o.key} className="cursor-pointer">
                <input type="checkbox" name="helpWanted" value={o.key} defaultChecked={Array.isArray(v?.helpWanted) && v.helpWanted.includes(o.key)} className="peer sr-only" />
                <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-white px-4 text-sm text-navy peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className={LABEL}>Who sees this</legend>
          <div className="mt-1 space-y-2">
            {([
              ['PRIVATE', 'Keep it private', 'Nothing from you is shown. Your answers count in the numbers for the company.'],
              ...(publishOpen ? [
                ['ANONYMOUS', 'Publish anonymously', 'Your story is shown with your function, level and tenure. No name, no email.'],
                ['NAMED', 'Publish with my name', 'Your story is shown with your name and job title. You can delete it at any time.'],
              ] : []),
            ] as [string, string, string][]).map(([k, label, hint]) => (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-brand">
                <input type="radio" name="visibility" value={k} checked={visibility === k} onChange={() => { setVisibility(k); posthog?.capture('layoff_story_visibility_chosen', { visibility: k }) }} className="mt-1" />
                <span><span className="block text-sm font-medium text-navy">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </div>
          {!publishOpen && <p className="mt-2 text-xs text-muted-foreground">Public stories are not open yet.</p>}
        </fieldset>

        <label className={`${LABEL} mt-4`}>Email {visibility === 'PRIVATE' ? '(optional)' : ''}
          <input name="email" type="email" defaultValue={str('email')} autoComplete="email" className={FIELD} />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{visibility === 'PRIVATE' ? 'Add it and your answers count in the company numbers once you confirm it. Without it we save your answers but do not count them. Never shown.' : 'To confirm it is you. Never shown.'}</span>
        </label>
        {visibility === 'NAMED' && <label className={`${LABEL} mt-4`}>Your name<input name="name" defaultValue={str('name')} autoComplete="name" className={FIELD} /></label>}
        {visibility !== 'NAMED' && <input type="hidden" name="name" value={str('name')} />}
      </div>

      {(stepError || state?.error) && <p role="alert" className="mt-4 text-sm text-red-700">{stepError || state?.error}</p>}
      <div className="mt-6 flex items-center gap-3">
        {step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="inline-flex h-11 items-center rounded-full border border-border bg-white px-5 text-sm font-semibold text-navy hover:bg-off-white">Back</button>}
        {step < 3 && <button type="button" onClick={next} className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:opacity-90">{step === 1 ? 'Next: how it went' : 'Next: your story'}</button>}
        {step === 3 && <SubmitButton pendingLabel="Sending">Send my answers</SubmitButton>}
      </div>
    </form>
  )
}
