'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { logOutreachTouch } from '@/app/support/admin/(portal)/crm/outreach/actions'
import { searchCrmPeopleByName, type CrmPersonSearchResult } from '@/app/support/admin/(portal)/crm/actions'

const CHANNELS = [{ key: 'call', label: 'Call' }, { key: 'linkedin', label: 'LinkedIn' }, { key: 'text', label: 'Text' }] as const
type Channel = (typeof CHANNELS)[number]['key']

const choice = (on: boolean) =>
  `rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy ${on ? 'border-navy bg-navy text-white' : 'border-border bg-white hover:border-navy/40'}`

const todayEastern = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

/** Log a call, LinkedIn message or text you made by hand. Calls ask how it went, because only a connected call counts as a response. */
export function LogTouchForm({ outcomes }: { outcomes: readonly string[] }) {
  const [channel, setChannel] = useState<Channel>('call')
  const [outcome, setOutcome] = useState('')
  const [date, setDate] = useState(todayEastern)
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [person, setPerson] = useState<CrmPersonSearchResult | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CrmPersonSearchResult[]>([])
  const [searching, startSearch] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On success clear who and how it went, but keep the channel and day so the next call is quick. On error nothing is cleared.
  const [state, formAction, pending] = useActionState(async (prev: Awaited<ReturnType<typeof logOutreachTouch>> | null, fd: FormData) => {
    const res = await logOutreachTouch(prev, fd)
    if (res.ok) { setPerson(null); setQuery(''); setResults([]); setOutcome(''); setNote(''); setTime('') }
    return res
  }, null)

  function onQuery(v: string) {
    setQuery(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(() => startSearch(async () => setResults(await searchCrmPeopleByName(v, ''))), 250)
  }

  return (
    <form action={formAction} className={`space-y-4 rounded-xl border border-border bg-white p-5 ${pending ? 'cursor-wait' : ''}`} aria-busy={pending}>
      <div>
        <h2 className="text-base font-semibold text-navy">Log a call, LinkedIn message or text</h2>
        <p className="text-sm text-muted-foreground">Counts in the totals and targets below. Emails log themselves.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="otr-person" className="text-xs text-muted-foreground">Who</label>
        {person ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span><span className="font-medium">{person.fullName}</span>{(person.title || person.org) && <span className="text-muted-foreground"> · {[person.title, person.org].filter(Boolean).join(', ')}</span>}</span>
            <button type="button" className="text-sm font-medium text-primary underline underline-offset-4" onClick={() => setPerson(null)}>Change person</button>
          </div>
        ) : (
          <div className="relative">
            <input id="otr-person" type="search" autoComplete="off" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Start typing a name or email" className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" aria-describedby="otr-person-hint" />
            <p id="otr-person-hint" className="mt-1 text-xs text-muted-foreground">{searching ? 'Searching…' : query.trim().length >= 2 && results.length === 0 ? 'No one found. Add them under People first.' : 'Choose them from the list.'}</p>
            {results.length > 0 && (
              <ul className="mt-1 divide-y divide-border rounded-md border border-border bg-white">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:bg-muted/50" onClick={() => { setPerson(r); setResults([]) }}>
                      <span className="font-medium">{r.fullName}</span>{(r.title || r.org) && <span className="text-muted-foreground"> · {[r.title, r.org].filter(Boolean).join(', ')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <input type="hidden" name="personId" value={person?.id ?? ''} />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-1">
          <span id="otr-channel" className="text-xs text-muted-foreground">How</span>
          <div className="flex gap-2" role="group" aria-labelledby="otr-channel">
            {CHANNELS.map((c) => <button key={c.key} type="button" aria-pressed={channel === c.key} className={choice(channel === c.key)} onClick={() => setChannel(c.key)}>{c.label}</button>)}
          </div>
          <input type="hidden" name="channel" value={channel} />
        </div>
        {channel === 'call' && (
          <div className="space-y-1">
            <span id="otr-outcome" className="text-xs text-muted-foreground">How it went</span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="otr-outcome">
              {outcomes.map((o) => <button key={o} type="button" aria-pressed={outcome === o} className={choice(outcome === o)} onClick={() => setOutcome(o)}>{o}</button>)}
            </div>
            <input type="hidden" name="outcome" value={outcome} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="space-y-1 text-xs text-muted-foreground">Day
          <input type="date" name="date" value={date} max={todayEastern()} onChange={(e) => setDate(e.target.value)} className="block rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Time, Eastern (optional)
          <input type="time" name="time" value={time} onChange={(e) => setTime(e.target.value)} className="block rounded-md border border-border bg-white px-2 py-1.5 text-sm text-foreground" />
        </label>
        <p className="max-w-xs self-end text-xs text-muted-foreground">Leave the time blank to use right now. A past day with no time is counted but left out of the time-of-day chart.</p>
      </div>

      <label className="block space-y-1 text-xs text-muted-foreground">Note (optional)
        <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground" />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Logging…" savedLabel="Logged">{channel === 'call' ? 'Log this call' : channel === 'text' ? 'Log this text' : 'Log this LinkedIn message'}</SubmitButton>
        <p role="status" aria-live="polite" className={`text-sm ${state && !state.ok ? 'text-destructive' : 'text-success'}`}>{state?.message}</p>
      </div>
    </form>
  )
}
