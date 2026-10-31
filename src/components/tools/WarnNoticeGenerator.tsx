'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { buildNotices, longDate, noticeDeadline, noticeProblems, type NoticeInput, type NoticeSet } from '@/lib/tools/warn-notice'
import { STATE_WARN_LAWS, stateWarnLaw } from '@/lib/warn-guide/rules'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY: NoticeInput = {
  company: '', siteName: '', siteAddress: '', contactName: '', contactPhone: '',
  action: 'closing', duration: 'permanent', entirePlant: true, firstSeparation: '', schedule: '',
  positions: [{ title: '', count: 1 }], bumping: false, unionName: '', unionOfficer: '', unionOfficerAddress: '', noticeDate: today(),
}

const FIELD = 'mt-1 w-full rounded-lg border border-border bg-white p-3 text-base'
const LABEL = 'block text-sm font-medium text-navy'

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2" role="radiogroup">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn('rounded-full border px-4 py-2 text-sm', value === v ? 'border-action bg-action text-action-foreground' : 'border-border bg-white text-navy hover:bg-off-white')}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Draft({ title, text, filename, onUse }: { title: string; text: string; filename: string; onUse: (what: 'copied' | 'downloaded') => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h3 className="text-base font-semibold text-navy">{title}</h3>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-off-white p-3 text-sm text-navy">{text}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10 rounded-full bg-action px-5 text-action-foreground hover:brightness-95"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
              onUse('copied')
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Copied' : 'Copy this notice'}
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
          download={filename}
          onClick={() => onUse('downloaded')}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-navy hover:bg-off-white"
        >
          Download as text
        </a>
      </div>
    </section>
  )
}

// A draft of the three federal WARN notices from a few facts. It runs in the browser: nothing is sent or saved, and the events
// carry choices and counts, never names or addresses. A state box shows the rule for the states whose laws are sourced.
export function WarnNoticeGenerator() {
  const [v, setV] = useState<NoticeInput>(EMPTY)
  const [state, setState] = useState('')
  const [hasUnion, setHasUnion] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const [notices, setNotices] = useState<NoticeSet | null>(null)
  const started = useRef(false)

  useEffect(() => {
    posthog.capture('warn_notice_viewed')
  }, [])

  const set = <K extends keyof NoticeInput>(k: K, val: NoticeInput[K]) => {
    setV((p) => ({ ...p, [k]: val }))
    if (!started.current) {
      started.current = true
      posthog.capture('warn_notice_started')
    }
  }
  const setPosition = (i: number, patch: Partial<NoticeInput['positions'][number]>) => set('positions', v.positions.map((p, k) => (k === i ? { ...p, ...patch } : p)))

  const law = state ? stateWarnLaw(state) : null
  const days = law?.noticeDays ?? 60
  const deadline = noticeDeadline(v.firstSeparation, days)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: NoticeInput = hasUnion ? v : { ...v, unionName: '', unionOfficer: '', unionOfficerAddress: '' }
    const found = noticeProblems(input)
    setProblems(found)
    if (found.length) {
      setNotices(null)
      posthog.capture('warn_notice_input_error', { problems: found.length })
      return
    }
    const set_ = buildNotices(input)
    setNotices(set_)
    posthog.capture('warn_notice_generated', { action: v.action, duration: v.duration, positions: v.positions.length, hasUnion, state: state || null, days })
  }

  return (
    <div className="mt-8 max-w-3xl space-y-6">
      <form onSubmit={submit} noValidate className="space-y-5 rounded-xl border border-border bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>Company name<input className={FIELD} value={v.company} onChange={(e) => set('company', e.target.value)} autoComplete="organization" /></label>
          <label className={LABEL}>Site name (optional)<input className={FIELD} value={v.siteName} onChange={(e) => set('siteName', e.target.value)} placeholder="Dayton Plant" /></label>
        </div>
        <label className={LABEL}>Site address<input className={FIELD} value={v.siteAddress} onChange={(e) => set('siteAddress', e.target.value)} placeholder="100 Main St, Dayton, OH 45402" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>Company official to contact<input className={FIELD} value={v.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Name and title" /></label>
          <label className={LABEL}>Phone number<input className={FIELD} value={v.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} inputMode="tel" autoComplete="tel" /></label>
        </div>

        <Choice label="What is happening" value={v.action} options={[['closing', 'A plant closing'], ['layoff', 'A mass layoff']] as const} onChange={(a) => set('action', a)} />
        <Choice label="How long" value={v.duration} options={[['permanent', 'Permanent'], ['temporary', 'Temporary']] as const} onChange={(d) => set('duration', d)} />
        {v.action === 'closing' && (
          <Choice label="Which part closes" value={v.entirePlant ? 'all' : 'part'} options={[['all', 'The entire plant'], ['part', 'One site or unit']] as const} onChange={(x) => set('entirePlant', x === 'all')} />
        )}
        <Choice label="Bumping rights" value={v.bumping ? 'yes' : 'no'} options={[['no', 'None'], ['yes', 'They exist']] as const} onChange={(x) => set('bumping', x === 'yes')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>Date of the first separation<input type="date" className={FIELD} value={v.firstSeparation} onChange={(e) => set('firstSeparation', e.target.value)} /></label>
          <label className={LABEL}>Date on the notices<input type="date" className={FIELD} value={v.noticeDate} onChange={(e) => set('noticeDate', e.target.value)} /></label>
        </div>
        <label className={LABEL}>When the other separations follow (optional)<input className={FIELD} value={v.schedule} onChange={(e) => set('schedule', e.target.value)} placeholder="The rest will follow on February 1 and March 1, 2027." /></label>

        <fieldset>
          <legend className={LABEL}>Job titles affected and how many employees hold each</legend>
          <ul className="mt-2 space-y-2">
            {v.positions.map((p, i) => (
              <li key={i} className="flex gap-2">
                <label className="sr-only" htmlFor={`wn-t-${i}`}>Job title {i + 1}</label>
                <input id={`wn-t-${i}`} className={cn(FIELD, 'mt-0 flex-1')} value={p.title} onChange={(e) => setPosition(i, { title: e.target.value })} placeholder="Machine operator" />
                <label className="sr-only" htmlFor={`wn-c-${i}`}>Number of employees in job title {i + 1}</label>
                <input id={`wn-c-${i}`} type="number" min={1} className={cn(FIELD, 'mt-0 w-24')} value={p.count} onChange={(e) => setPosition(i, { count: Number(e.target.value) })} />
                {v.positions.length > 1 && (
                  <button type="button" className="rounded-lg border border-border px-3 text-sm text-navy hover:bg-off-white" onClick={() => set('positions', v.positions.filter((_, k) => k !== i))}>Remove</button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="mt-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-navy hover:bg-off-white" onClick={() => set('positions', [...v.positions, { title: '', count: 1 }])}>Add a job title</button>
        </fieldset>

        <Choice label="Does a union represent the affected employees?" value={hasUnion ? 'yes' : 'no'} options={[['no', 'No'], ['yes', 'Yes']] as const} onChange={(x) => setHasUnion(x === 'yes')} />
        {hasUnion && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={LABEL}>Union name<input className={FIELD} value={v.unionName} onChange={(e) => set('unionName', e.target.value)} /></label>
            <label className={LABEL}>Chief elected officer<input className={FIELD} value={v.unionOfficer} onChange={(e) => set('unionOfficer', e.target.value)} /></label>
            <label className={LABEL}>Officer’s address<input className={FIELD} value={v.unionOfficerAddress} onChange={(e) => set('unionOfficerAddress', e.target.value)} /></label>
          </div>
        )}

        <label className={LABEL}>
          State of the site (optional)
          <select className={FIELD} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Not listed or not sure</option>
            {STATE_WARN_LAWS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        {law ? (
          <div className="rounded-lg bg-off-white p-4 text-sm text-navy">
            <p className="font-semibold">{law.name} has its own law</p>
            <p className="mt-1">{law.summary}</p>
            <p className="mt-1 text-muted-foreground">{law.differs}</p>
            {law.caveat && <p className="mt-1 text-muted-foreground">Note: {law.caveat}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">We list the state laws we have read from the state’s own pages. Other states may have their own notice rules too; check your state labor department as well as the federal rule.</p>
        )}
        {deadline && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            For a first separation on {longDate(v.firstSeparation)}, notice should go out by <strong>{longDate(deadline)}</strong> ({days} days ahead{days === 60 ? ', the federal rule' : `, ${law?.name}’s rule`}).
          </p>
        )}

        <Button type="submit" className="h-11 rounded-full bg-action px-6 text-action-foreground hover:brightness-95">Draft the notices</Button>
        {problems.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Everything stays in your browser. Nothing is sent to us or saved.</p>
      </form>

      {notices && (
        <div role="status" className="space-y-4">
          <p className="text-sm text-foreground">
            Three drafts below. Replace the bracketed parts, have a lawyer read them, and add anything your state requires. This is not legal advice.
          </p>
          <Draft title="Notice to each affected employee" text={notices.employee} filename="warn-notice-employee.txt" onUse={(w) => posthog.capture(`warn_notice_${w}`, { which: 'employee' })} />
          {notices.union && <Draft title="Notice to the union representing the employees" text={notices.union} filename="warn-notice-union.txt" onUse={(w) => posthog.capture(`warn_notice_${w}`, { which: 'union' })} />}
          <Draft title="Notice to the State dislocated worker unit and the local chief elected official" text={notices.government} filename="warn-notice-government.txt" onUse={(w) => posthog.capture(`warn_notice_${w}`, { which: 'government' })} />
          <div className="rounded-xl border border-border bg-white p-5 text-sm">
            <p className="font-semibold text-navy">Supporting the people who are leaving</p>
            <p className="mt-1 text-muted-foreground">NextChapter provides outplacement for employers: coaching, a job search plan and reporting on outcomes.</p>
            <Link href="/outplacement" onClick={() => posthog.capture('warn_notice_outplacement_clicked', { state: state || null })} className="mt-3 inline-flex h-10 items-center rounded-full bg-action px-5 font-semibold text-action-foreground hover:brightness-95">
              See outplacement for employers
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
