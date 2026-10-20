'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { deleteOutcome, logOutcome, toggleOutcomeFollowUp } from '@/app/dashboard/in-work/actions'
import type { OutcomeView, WorkspaceData } from '@/lib/in-work/workspace-data'
import { ActionButton as Button, ChoiceButtons, ConfirmDelete, Field, NoticeLine, Section, formatDate, today, useRunner, useType } from './shared'

type Tri = 'yes' | 'no' | 'unknown'
const TRI = [
  { key: 'yes' as const, label: 'Yes' },
  { key: 'no' as const, label: 'No' },
  { key: 'unknown' as const, label: 'Not decided yet' },
]

export function OutcomeTab({ data }: { data: WorkspaceData }) {
  const defaultCycle = data.lastCycle?.key ?? null
  const [reviewedOn, setReviewedOn] = useState(today())
  const [rating, setRating] = useState('')
  const [raise, setRaise] = useState<Tri>('unknown')
  const [percent, setPercent] = useState('')
  const [promoted, setPromoted] = useState<'yes' | 'no'>('no')
  const [newTitle, setNewTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [followUps, setFollowUps] = useState('')
  const log = useRunner()
  const t = useType()

  return (
    <div className="space-y-6">
      <Section
        title="How did your review go?"
        intro="Log the result and what you agreed to do next. Your next prep starts from this."
      >
        <div className={cn('space-y-4', log.pending && 'cursor-wait')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date of the review">
              <Input type="date" value={reviewedOn} onChange={(e) => setReviewedOn(e.target.value)} />
            </Field>
            <Field label="Rating or result" hint="In your company's own words, for example Exceeds expectations.">
              <Input value={rating} maxLength={300} onChange={(e) => setRating(e.target.value)} />
            </Field>
          </div>
          <Field label="Did you get a raise?">
            <ChoiceButtons value={raise} options={TRI} onChange={setRaise} label="Raise" />
          </Field>
          {raise === 'yes' && (
            <Field label="Raise, in percent (optional)">
              <Input inputMode="decimal" className="max-w-40" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="6" />
            </Field>
          )}
          <Field label="Were you promoted?">
            <ChoiceButtons value={promoted} options={[{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }] as const} onChange={setPromoted} label="Promotion" />
          </Field>
          {promoted === 'yes' && (
            <Field label="New title (optional)">
              <Input value={newTitle} maxLength={300} onChange={(e) => setNewTitle(e.target.value)} />
            </Field>
          )}
          <Field label="Notes (optional)">
            <Textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="Follow-ups" hint="What was promised, by you or by them. One per line.">
            <Textarea rows={3} maxLength={2000} value={followUps} onChange={(e) => setFollowUps(e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <Button
              disabled={log.pending || !reviewedOn}
              onClick={() => {
                const pct = percent.trim() === '' ? null : Number(percent)
                log.run(
                  () =>
                    logOutcome({
                      cycleKey: defaultCycle,
                      reviewedOn,
                      rating,
                      raiseReceived: raise === 'unknown' ? null : raise === 'yes',
                      raisePercent: pct !== null && Number.isFinite(pct) ? pct : null,
                      promoted: promoted === 'yes',
                      newTitle,
                      notes,
                      followUps: followUps.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10),
                    }),
                  'Outcome logged.',
                  () => {
                    setRating('')
                    setNotes('')
                    setFollowUps('')
                    setPercent('')
                    setNewTitle('')
                  },
                )
              }}
            >
              {log.pending ? 'Saving…' : 'Log review outcome'}
            </Button>
            <NoticeLine notice={log.notice} />
          </div>
        </div>
      </Section>

      <Section title="History">
        {data.outcomes.length === 0 ? (
          <p className={cn('text-muted-foreground', t.body)}>No reviews logged yet.</p>
        ) : (
          <ul className={t.redesign ? 'divide-y divide-border' : 'space-y-4'}>
            {data.outcomes.map((o) => (
              <OutcomeEntry key={o.id} outcome={o} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function OutcomeEntry({ outcome: o }: { outcome: OutcomeView }) {
  const r = useRunner()
  const t = useType()
  const bits = [
    o.rating ? `Rating: ${o.rating}` : null,
    o.raiseReceived === true ? (o.raisePercent != null ? `Raise of ${o.raisePercent}%` : 'Raise received') : o.raiseReceived === false ? 'No raise' : null,
    o.promoted ? (o.newTitle ? `Promoted to ${o.newTitle}` : 'Promoted') : null,
  ].filter(Boolean)
  return (
    <li className={cn('space-y-2', t.body, t.redesign ? 'py-4 first:pt-0' : 'rounded-lg border border-border p-3', r.pending && 'cursor-wait')}>
      <p className={cn('font-medium', t.redesign ? 'font-display text-lg font-semibold text-ink' : 'text-foreground')}>{formatDate(o.reviewedOn)}</p>
      {bits.length > 0 && <p className={t.redesign ? 'text-ink' : 'text-foreground/80'}>{bits.join(t.redesign ? '. ' : ' · ')}</p>}
      {o.notes && <p className={t.redesign ? 'max-w-2xl text-ink' : 'text-foreground/80'}>{o.notes}</p>}
      {o.followUps.length > 0 && (
        <ul className="space-y-1">
          {o.followUps.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <input type="checkbox" aria-label={`Done: ${f.text}`} checked={f.done} onChange={() => r.run(() => toggleOutcomeFollowUp(o.id, f.id), 'Updated.')} />
              <span className={cn(f.done && 'text-muted-foreground line-through')}>{f.text}</span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDelete what="entry" pending={r.pending} onConfirm={() => r.run(() => deleteOutcome(o.id), 'Deleted.')} />
      <NoticeLine notice={r.notice} />
    </li>
  )
}
