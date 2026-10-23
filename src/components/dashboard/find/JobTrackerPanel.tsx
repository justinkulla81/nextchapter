'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { JobStatus } from '@/lib/jobs/my-jobs'
import type { TrackerFields } from '@/lib/jobs/my-jobs-merge'
import type { KeywordMatch } from '@/lib/jobs/keyword-match'
import { keywordMatchLabel } from '@/lib/jobs/keyword-match'
import { CHECKLIST_ITEMS, checklistState, followUpLine, suggestedFollowUp, toDateInput, type Checklist, type ChecklistKey } from '@/lib/jobs/tracker'
import {
  searchTrackerContacts,
  setTrackerContact,
  updateTrackerNote,
  type ContactOption,
  type TrackerPatch,
  type TrackerRowRef,
} from '@/app/dashboard/find-my-job/tracker-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// The tracker fields for one job in My jobs, opened under the row's "Details": how excited you are, when
// to follow up, the application checklist, who can help, your notes, and how your resume's keywords match
// the job. Every change saves on its own; nothing here calls a model.

const EMPTY: TrackerFields = { notes: null, excitement: null, followUpAt: null, followUpDoneAt: null, checklist: {}, contacts: [], hasJobText: false }
const RESUME_STUDIO_HREF = '/dashboard/resume/studio'

export function JobTrackerPanel({
  row,
  status,
  statusDate,
  tracker,
  keywordMatch,
  now = new Date(),
}: {
  row: TrackerRowRef
  status: JobStatus
  statusDate: Date
  tracker: TrackerFields | null
  keywordMatch: KeywordMatch | null
  now?: Date
}) {
  const initial = tracker ?? EMPTY
  const [excitement, setExcitement] = useState(initial.excitement)
  const [followUp, setFollowUp] = useState(toDateInput(initial.followUpAt))
  const [followUpDone, setFollowUpDone] = useState(!!initial.followUpDoneAt)
  const [checklist, setChecklist] = useState<Checklist>(initial.checklist)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [savedNotes, setSavedNotes] = useState(initial.notes ?? '')
  const [contacts, setContacts] = useState(initial.contacts)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(patch: TrackerPatch, undo: () => void, done: string) {
    setError(null)
    setSaved(null)
    startTransition(async () => {
      const r = await updateTrackerNote(row, patch)
      if (!r.ok) {
        undo()
        setError(r.error)
      } else setSaved(done)
    })
  }

  const ticks = checklistState(checklist, status)
  const followUpDate = followUp ? new Date(`${followUp}T12:00:00.000Z`) : null
  const line = followUpLine(followUpDate, followUpDone ? new Date() : null, now)
  const suggestion = !followUp ? suggestedFollowUp(status, statusDate) : null

  return (
    <div className={cn('space-y-5 pt-3', pending && 'cursor-wait')} aria-busy={pending}>
      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">How excited are you?</legend>
          <div role="group" aria-label="Excitement, 1 to 5" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={excitement !== null && n <= excitement}
                aria-label={`${n} of 5`}
                onClick={() => {
                  const before = excitement
                  const next = excitement === n ? null : n
                  setExcitement(next)
                  save({ kind: 'excitement', excitement: next }, () => setExcitement(before), next ? `Excitement ${next} of 5` : 'Excitement cleared')
                }}
                className={cn('size-8 rounded-full border text-sm', excitement !== null && n <= excitement ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor={`fu-${row.itemKey}`} className="block text-sm font-semibold text-ink">
            Follow up on
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`fu-${row.itemKey}`}
              type="date"
              value={followUp}
              onChange={(e) => {
                const before = followUp
                const beforeDone = followUpDone
                setFollowUp(e.target.value)
                setFollowUpDone(false)
                save({ kind: 'follow_up', date: e.target.value }, () => (setFollowUp(before), setFollowUpDone(beforeDone)), e.target.value ? 'Follow-up date saved. It shows in Job Search Daily when it is due.' : 'Follow-up date cleared')
              }}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
            {followUp && !followUpDone && (
              <button
                type="button"
                onClick={() => {
                  const before = checklist
                  setFollowUpDone(true)
                  setChecklist({ ...checklist, follow_up_sent: new Date().toISOString() })
                  save({ kind: 'follow_up_sent' }, () => (setFollowUpDone(false), setChecklist(before)), 'Marked the follow-up as sent')
                }}
                className="rounded-full border border-border px-3 py-1 text-sm text-ink hover:bg-muted"
              >
                Mark sent
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {followUpDone ? 'Follow-up sent.' : line ?? (suggestion ? `A week after applying is a good time: ${suggestion.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}.` : 'Pick a day and it shows in your Job Search Daily email.')}
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Checklist</legend>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {CHECKLIST_ITEMS.map((item) => {
            const auto = item.key === 'applied'
            return (
              <li key={item.key}>
                <label className={cn('flex items-center gap-2 text-sm', auto ? 'text-muted-foreground' : 'text-ink')}>
                  <input
                    type="checkbox"
                    checked={ticks[item.key as ChecklistKey]}
                    disabled={auto}
                    onChange={(e) => {
                      if (auto) return
                      const key = item.key as Exclude<ChecklistKey, 'applied'>
                      const before = checklist
                      const next = { ...checklist }
                      if (e.target.checked) next[key] = new Date().toISOString()
                      else delete next[key]
                      setChecklist(next)
                      if (key === 'follow_up_sent' && followUp) setFollowUpDone(e.target.checked)
                      save({ kind: 'checklist', key, checked: e.target.checked }, () => setChecklist(before), 'Checklist saved')
                    }}
                    className="size-4"
                  />
                  {item.label}
                  {auto && <span className="text-xs">(ticks itself when you mark the job applied)</span>}
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <ContactsPicker row={row} contacts={contacts} setContacts={setContacts} setError={setError} />

      <div className="space-y-2">
        <label htmlFor={`notes-${row.itemKey}`} className="block text-sm font-semibold text-ink">
          Notes
        </label>
        <textarea
          id={`notes-${row.itemKey}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Who you spoke to, what they said, what to ask next."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {notes !== savedNotes && (
          <button
            type="button"
            onClick={() => {
              const before = savedNotes
              setSavedNotes(notes)
              save({ kind: 'notes', notes }, () => setSavedNotes(before), 'Notes saved')
            }}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Save notes
          </button>
        )}
      </div>

      {keywordMatch && <KeywordMatchBlock match={keywordMatch} jobKey={row.itemKey} />}

      <p role="status" className="min-h-5 text-sm">
        {error ? <span className="text-destructive">{error}</span> : saved ? <span className="text-muted-foreground">{saved}</span> : null}
      </p>
    </div>
  )
}

function KeywordMatchBlock({ match, jobKey }: { match: KeywordMatch; jobKey: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">
        Resume keywords{match.score !== null && <>: {match.score}% · {keywordMatchLabel(match.score)}</>}
      </p>
      <p className="text-xs text-muted-foreground">The skills and tools this job names, against the ones your resume and confirmed skills show.</p>
      {match.matched.length > 0 && (
        <p className="text-sm text-ink">
          <span className="font-medium">You show:</span> {match.matched.join(', ')}
        </p>
      )}
      {match.missing.length > 0 && (
        <p className="text-sm text-ink">
          <span className="font-medium">Missing:</span> {match.missing.join(', ')}.{' '}
          <Link
            href={RESUME_STUDIO_HREF}
            onClick={() => posthog.capture('job_keyword_match_tailor_clicked', { jobKey, score: match.score, missing: match.missing.length })}
            className="text-brand underline underline-offset-4"
          >
            Add the ones you have to your resume
          </Link>
        </p>
      )}
    </div>
  )
}

function ContactsPicker({
  row,
  contacts,
  setContacts,
  setError,
}: {
  row: TrackerRowRef
  contacts: ContactOption[]
  setContacts: (c: ContactOption[]) => void
  setError: (e: string | null) => void
}) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<ContactOption[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const t = setTimeout(() => {
      searchTrackerContacts(term).then(setOptions).catch(() => setOptions([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  function change(c: ContactOption, linked: boolean) {
    const before = contacts
    setContacts(linked ? [...contacts.filter((x) => x.id !== c.id), c] : contacts.filter((x) => x.id !== c.id))
    setQ('')
    setOptions([])
    setError(null)
    startTransition(async () => {
      const r = await setTrackerContact(row, c.id, linked)
      if (!r.ok) {
        setContacts(before)
        setError(r.error)
      }
    })
  }

  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <label htmlFor={`contacts-${row.itemKey}`} className="block text-sm font-semibold text-ink">
        Who can help
      </label>
      {contacts.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Contacts linked to this job">
          {contacts.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-ink">
              {c.name}
              {c.company && <span className="text-muted-foreground">· {c.company}</span>}
              <button type="button" onClick={() => change(c, false)} aria-label={`Remove ${c.name}`} className="ml-1 text-muted-foreground hover:text-ink">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={`contacts-${row.itemKey}`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your contacts by name or company"
        autoComplete="off"
        className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm"
      />
      {q.trim().length >= 2 && options.length > 0 && (
        <ul className="max-w-sm divide-y divide-border rounded-md border border-border" aria-label="Matching contacts">
          {options
            .filter((o) => !contacts.some((c) => c.id === o.id))
            .map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => change(o, true)} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-muted">
                  {o.name}
                  {o.company && <span className="text-muted-foreground"> · {o.company}</span>}
                </button>
              </li>
            ))}
        </ul>
      )}
      {q.trim().length >= 2 && options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No contact by that name yet.{' '}
          <Link href="/dashboard/network/contacts" className="underline underline-offset-4">
            Add one in Contacts
          </Link>
        </p>
      )}
    </div>
  )
}
