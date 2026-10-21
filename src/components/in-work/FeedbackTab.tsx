'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { posthog } from '@/lib/posthog/client'
import {
  addFeedback,
  addFeedbackActionItem,
  deleteFeedback,
  sendFeedbackActionToSprint,
  toggleFeedbackActionItem,
} from '@/app/dashboard/in-work/actions'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SOURCES,
  isFeedbackCategory,
  isFeedbackSource,
  type FeedbackCategory,
  type FeedbackSource,
} from '@/lib/in-work/constants'
import { FEEDBACK_STEPS, buildMeetingScript, buildWrittenReply } from '@/lib/in-work/templates'
import type { FeedbackView, WorkspaceData } from '@/lib/in-work/workspace-data'
import { ActionButton as Button, ConfirmDelete, CopyBlock, Field, NoticeLine, Section, formatDate, selectClass, today, useRunner, useType } from './shared'

const sourceLabel = (k: string) => FEEDBACK_SOURCES.find((s) => s.key === k)?.label ?? k
const categoryLabel = (k: string) => FEEDBACK_CATEGORIES.find((c) => c.key === k)?.label ?? k

export function FeedbackTab({ data }: { data: WorkspaceData }) {
  const [source, setSource] = useState<FeedbackSource>('MANAGER')
  const [category, setCategory] = useState<FeedbackCategory>('GROWTH_AREA')
  const [date, setDate] = useState(today())
  const [said, setSaid] = useState('')
  const [actions, setActions] = useState('')
  const add = useRunner()
  const t = useType()

  return (
    <div className="space-y-6">
      <Section title="Log feedback" intro="Write it down as soon as you can, in their words. It is easier to respond to what was said than to what you remember.">
        <div className={cn('space-y-3', add.pending && 'cursor-wait')}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Who said it?">
              <select className={selectClass} value={source} onChange={(e) => isFeedbackSource(e.target.value) && setSource(e.target.value)}>
                {FEEDBACK_SOURCES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="What kind is it?">
              <select className={selectClass} value={category} onChange={(e) => isFeedbackCategory(e.target.value) && setCategory(e.target.value)}>
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="When?">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="What was said?">
            <Textarea rows={3} maxLength={2000} value={said} onChange={(e) => setSaid(e.target.value)} />
          </Field>
          <Field label="What will you do about it? (optional)" hint="One action per line. You can add more later.">
            <Textarea rows={2} maxLength={2000} value={actions} onChange={(e) => setActions(e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <Button
              disabled={add.pending || !said.trim()}
              onClick={() =>
                add.run(
                  () =>
                    addFeedback({
                      source,
                      category,
                      receivedOn: date,
                      whatWasSaid: said,
                      actionItems: actions.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10),
                    }),
                  'Feedback logged.',
                  () => {
                    setSaid('')
                    setActions('')
                  },
                )
              }
            >
              {add.pending ? 'Saving…' : 'Log feedback'}
            </Button>
            {!said.trim() && <span className={cn('text-muted-foreground', t.hint)}>Write what was said to enable this.</span>}
            <NoticeLine notice={add.notice} />
          </div>
        </div>
      </Section>

      <Section title={`Feedback you have logged (${data.feedback.length})`}>
        {data.feedback.length === 0 ? (
          <p className={cn('text-muted-foreground', t.body)}>Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.feedback.map((f) => (
              <FeedbackEntry key={f.id} entry={f} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function FeedbackEntry({ entry }: { entry: FeedbackView }) {
  const [open, setOpen] = useState(false)
  const [newAction, setNewAction] = useState('')
  const [change, setChange] = useState('')
  const [by, setBy] = useState('')
  const r = useRunner()
  const t = useType()

  const reply = { source: entry.source as FeedbackSource, category: entry.category as FeedbackCategory, point: entry.whatWasSaid, change: change || entry.actionItems.find((a) => !a.done)?.text, by }

  return (
    <li className={cn('space-y-3 py-5 first:pt-0', t.body, r.pending && 'cursor-wait')}>
      <div className="space-y-1">
        <p className={cn('text-muted-foreground', t.meta)}>
          {sourceLabel(entry.source)}, {categoryLabel(entry.category)}, {formatDate(entry.receivedOn)}
        </p>
        <p className="max-w-2xl font-display text-lg text-ink">{entry.whatWasSaid}</p>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-ink">Your actions</p>
        {entry.actionItems.length === 0 && <p className="text-muted-foreground">No actions yet.</p>}
        <ul className="space-y-1.5">
          {entry.actionItems.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <input type="checkbox" aria-label={`Done: ${a.text}`} checked={a.done} onChange={() => r.run(() => toggleFeedbackActionItem(entry.id, a.id), 'Updated.')} />
              <span className={cn(a.done && 'text-muted-foreground line-through')}>{a.text}</span>
              {!a.done && !a.sprintAddedAt && (
                <button
                  type="button"
                  className={cn('font-medium text-brand underline', t.meta)}
                  onClick={() =>
                    r.run(() => sendFeedbackActionToSprint(entry.id, a.id), 'Done.', (res) => {
                      r.setNotice({ kind: res.added ? 'ok' : 'error', text: res.message })
                    })
                  }
                >
                  Add to this week&apos;s plan
                </button>
              )}
              {a.sprintAddedAt && <span className={cn(t.meta, 'font-medium text-ink')}>In your weekly plan</span>}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={newAction} maxLength={300} className="h-9" placeholder="Add an action" aria-label="Add an action" onChange={(e) => setNewAction(e.target.value)} />
          <Button
            variant="outline"
            size="sm"
            disabled={!newAction.trim() || r.pending}
            onClick={() => r.run(() => addFeedbackActionItem(entry.id, newAction), 'Action added.', () => setNewAction(''))}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o)
            if (!open) posthog.capture('in_work_feedback_guide_opened', { category: entry.category, source: entry.source })
          }}
        >
          {open ? 'Hide response guide' : 'Prepare my response'}
        </Button>
        <ConfirmDelete what="entry" pending={r.pending} onConfirm={() => r.run(() => deleteFeedback(entry.id), 'Deleted.')} />
      </div>
      <NoticeLine notice={r.notice} />

      {open && (
        <div className="space-y-4 pt-2">
          <ol className="space-y-2">
            {FEEDBACK_STEPS.map((s, i) => (
              <li key={s.key}>
                <span className="font-medium text-ink">
                  {i + 1}. {s.label}.
                </span>{' '}
                <span className="text-ink">{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="The one change you will make">
              <Input value={change} maxLength={300} onChange={(e) => setChange(e.target.value)} placeholder={entry.actionItems.find((a) => !a.done)?.text ?? 'Send a written update every Friday'} />
            </Field>
            <Field label="Starting when">
              <Input value={by} maxLength={100} onChange={(e) => setBy(e.target.value)} placeholder="next Monday" />
            </Field>
          </div>
          <div>
            <p className="mb-1 font-medium text-ink">Reply in writing</p>
            <CopyBlock text={buildWrittenReply(reply)} label="Copy written reply" />
          </div>
          <div>
            <p className="mb-1 font-medium text-ink">For the conversation</p>
            <CopyBlock text={buildMeetingScript(reply)} label="Copy conversation script" />
          </div>
        </div>
      )}
    </li>
  )
}
