'use client'

import { useActionState, useState } from 'react'
import { removeStoryEvent, saveStoryEvent, type StoryFormState } from '@/app/dashboard/my-career/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAUSE_REASONS, type StoryEvent } from '@/lib/career-story/events'
import { whenText } from '@/lib/career-story/layout'

const ADD_KINDS = [
  { key: 'PAUSE', label: 'A pause' },
  { key: 'VENTURE', label: 'A venture of my own' },
  { key: 'SCHOOL', label: 'School or training' },
  { key: 'LEARNING', label: 'Something I learned' },
  { key: 'MILESTONE', label: 'A moment worth marking' },
  { key: 'WORK', label: 'A job' },
] as const

const selectClass = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

// Add a chapter, or describe / correct one. Everything typed stays on screen if a save fails.
export function EventEditor({ event, onDone, defaultKind }: { event: StoryEvent | null; onDone: () => void; defaultKind?: string }) {
  const [state, action] = useActionState<StoryFormState, FormData>(async (prev, fd) => {
    const result = await saveStoryEvent(prev, fd)
    if (result?.saved) onDone()
    return result
  }, undefined)
  const memberOwned = event?.source === 'MEMBER'
  const [kind, setKind] = useState(event?.kind ?? defaultKind ?? 'PAUSE')
  const [label, setLabel] = useState(event && !event.unlabeled ? event.label : '')
  const [detail, setDetail] = useState(event?.detail ?? '')
  const [start, setStart] = useState(event?.start ?? '')
  const [end, setEnd] = useState(event?.end ?? '')
  const [reason, setReason] = useState<string>(event?.reason ?? '')
  const point = kind === 'LEARNING' || kind === 'MILESTONE'
  const lockedKind = !!event
  return (
    <form action={action} className="space-y-4" aria-label={event ? 'Edit this chapter' : 'Add a chapter'}>
      <input type="hidden" name="id" value={memberOwned ? event!.id.replace(/^m:/, '') : ''} />
      <input type="hidden" name="sourceRef" value={event && !memberOwned ? (event.sourceRef ?? '') : ''} />
      <input type="hidden" name="kind" value={kind} />
      {!lockedKind && (
        <div className="space-y-1.5">
          <Label htmlFor="story-kind">What kind of chapter is it?</Label>
          <select id="story-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass}>
            {ADD_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="story-label">{event?.unlabeled ? 'What happened? (optional)' : 'Name it'}</Label>
        <Input id="story-label" name="label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={kind === 'PAUSE' ? 'Caring for family' : 'A short name'} />
      </div>
      {kind === 'PAUSE' && (
        <div className="space-y-1.5">
          <Label htmlFor="story-reason">Reason, if you want to say</Label>
          <select id="story-reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
            <option value="">I would rather not say</option>
            {PAUSE_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="story-start">{point ? 'When' : 'Started'}</Label>
          <Input id="story-start" name="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        {!point && (
          <div className="space-y-1.5">
            <Label htmlFor="story-end">Ended (leave empty if it is ongoing)</Label>
            <Input id="story-end" name="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="story-detail">A note for yourself (optional)</Label>
        <Input id="story-detail" name="detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={400} />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel="Saving…">{event ? 'Save changes' : 'Add to my story'}</SubmitButton>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// The detail panel for a selected chapter, with edit and remove. Removing asks first, and the
// safe choice (keep it) has the focus.
export function EventDetail({ event, now, hideYears, onClose }: { event: StoryEvent; now: Date; hideYears: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>(event.unlabeled ? 'edit' : 'view')
  const [removeState, removeAction] = useActionState<StoryFormState, FormData>(async (_p, fd) => {
    const r = await removeStoryEvent(fd)
    if (r?.saved) onClose()
    return r
  }, undefined)
  const reason = PAUSE_REASONS.find((r) => r.key === event.reason)?.label
  const memberOwned = event.source === 'MEMBER'
  if (mode === 'edit') return <EventEditor event={event} onDone={() => (event.unlabeled ? onClose() : setMode('view'))} />
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-foreground">{event.title}</p>
        <p className="text-sm text-muted-foreground">
          {whenText(event, now, hideYears)}
          {reason ? ` · ${reason}` : ''}
        </p>
      </div>
      {event.detail && <p className="text-sm text-foreground">{event.detail}</p>}
      {event.source === 'INFERRED' && <p className="text-sm text-muted-foreground">Everyone has quiet stretches. Describe this one if you want it to be part of your story, or leave it as it is.</p>}
      {event.approx && <p className="text-sm text-muted-foreground">We estimated these dates from your graduation date. Change them if they are off.</p>}
      {mode === 'view' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMode('edit')}>
            {event.source === 'INFERRED' ? 'Describe this' : 'Edit'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode('confirm')}>
            {memberOwned ? 'Remove from my story' : 'Hide from my story'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
      {mode === 'confirm' && (
        <form action={removeAction} className="space-y-2 rounded-lg border border-border p-3">
          <input type="hidden" name="id" value={memberOwned ? event.id.replace(/^m:/, '') : ''} />
          <input type="hidden" name="sourceRef" value={memberOwned ? '' : (event.sourceRef ?? '')} />
          <input type="hidden" name="label" value={event.label} />
          <input type="hidden" name="start" value={event.start} />
          <p className="text-sm text-foreground">
            {memberOwned ? 'Remove this chapter from your story?' : 'Hide this from your story? Your work history and profile stay exactly as they are.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" autoFocus onClick={() => setMode('view')}>
              Keep it
            </Button>
            <SubmitButton variant="outline" pendingLabel="Working…" savedLabel={memberOwned ? 'Removed' : 'Hidden'}>
              {memberOwned ? 'Yes, remove it' : 'Yes, hide it'}
            </SubmitButton>
          </div>
          {removeState?.error && (
            <p role="alert" className="text-sm text-error">
              {removeState.error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
