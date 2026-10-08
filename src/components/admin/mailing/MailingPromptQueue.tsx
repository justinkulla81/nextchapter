'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { answerPromptYes, answerPromptLater } from '@/app/support/admin/(portal)/crm/mailing/actions'
import { MailingListChecklist, type ListOption } from './MailingListChecklist'
import type { PromptCard } from '@/lib/mailing/prompt-cards'

const ago = (iso: string | null) => {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * The "Add to a mailing list?" cards. Step 1 is Yes / Not now / Never;
 * Yes opens step 2, the lists with the suggested ones ticked. Ticking
 * several cards answers them together.
 */
export function MailingPromptQueue({ cards, lists, compact = false }: { cards: PromptCard[]; lists: ListOption[]; compact?: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [open, setOpen] = useState<string[] | null>(null) // person ids whose step 2 is showing
  const [hidden, setHidden] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const visible = cards.filter((c) => !hidden.includes(c.personId))
  if (visible.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{message ?? 'Nobody waiting. New cards appear when the Gmail sync sees an email you sent.'}</p>
  }

  const later = (ids: string[], answer: 'snooze' | 'never') =>
    start(async () => {
      await answerPromptLater(ids, answer)
      posthog.capture('mailing_prompt_clicked', { answer, people: ids.length })
      setHidden((h) => [...h, ...ids])
      setSelected((s) => s.filter((x) => !ids.includes(x)))
      setMessage(answer === 'never' ? 'Won’t ask about them again.' : 'Asked again in 90 days.')
      router.refresh()
    })

  return (
    <div className={`space-y-3 ${pending ? 'cursor-wait' : ''}`}>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}

      {selected.length > 1 && !open && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <button type="button" onClick={() => setOpen(selected)} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white">Yes, add them</button>
          <button type="button" onClick={() => later(selected, 'snooze')} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Not now</button>
          <button type="button" onClick={() => later(selected, 'never')} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Never</button>
        </div>
      )}

      {open && open.length > 1 && (
        <StepTwo
          lists={lists}
          title={`Add ${open.length} people to:`}
          suggested={intersect(open.map((id) => cards.find((c) => c.personId === id)?.suggestedKeys ?? []))}
          onCancel={() => setOpen(null)}
          onSave={(listIds, repliedYes, note) => start(async () => {
            const r = await answerPromptYes(open, listIds, repliedYes, note)
            posthog.capture('mailing_prompt_clicked', { answer: 'yes', people: open.length, lists: listIds.length, repliedYes })
            setHidden((h) => [...h, ...open]); setSelected([]); setOpen(null); setMessage(r.message); router.refresh()
          })}
          pending={pending}
        />
      )}

      <ul className="space-y-2">
        {visible.map((c) => (
          <li key={c.personId} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-3">
              {!compact && (
                <input
                  type="checkbox" aria-label={`Select ${c.name}`} checked={selected.includes(c.personId)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.personId] : s.filter((x) => x !== c.personId)))}
                />
              )}
              <p className="text-sm">
                You emailed <a href={`/support/admin/crm/people/${c.personId}`} className="font-medium hover:underline">{c.name}</a>
                {c.orgName && <span className="text-muted-foreground"> ({c.orgName})</span>} {ago(c.lastEmailedAt)}
                {c.lastSubject && <span className="text-muted-foreground"> — &ldquo;{c.lastSubject}&rdquo;</span>}.{' '}
                {c.onListKeys.length > 0 ? 'Add to more lists?' : 'Add to a mailing list?'}
              </p>
              {open?.length !== 1 || open[0] !== c.personId ? (
                <div className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => setOpen([c.personId])} className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white">Yes</button>
                  <button type="button" onClick={() => later([c.personId], 'snooze')} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted" title="Ask again in 90 days">Not now</button>
                  <button type="button" onClick={() => later([c.personId], 'never')} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted" title="Stop asking about them">Never</button>
                </div>
              ) : null}
            </div>
            {open?.length === 1 && open[0] === c.personId && (
              <div className="mt-3">
                <StepTwo
                  lists={lists.filter((l) => !c.onListKeys.includes(l.key))}
                  title={c.onListKeys.length ? `Already on ${c.onListKeys.length} ${c.onListKeys.length === 1 ? 'list' : 'lists'}. Also add to:` : 'Add to:'}
                  suggested={c.suggestedKeys}
                  onCancel={() => setOpen(null)}
                  onSave={(listIds, repliedYes, note) => start(async () => {
                    const r = await answerPromptYes([c.personId], listIds, repliedYes, note)
                    posthog.capture('mailing_prompt_clicked', { answer: 'yes', people: 1, lists: listIds.length, repliedYes })
                    setHidden((h) => [...h, c.personId]); setOpen(null); setMessage(`${c.name}: ${r.message}`); router.refresh()
                  })}
                  pending={pending}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function intersect(arrays: string[][]): string[] {
  if (arrays.length === 0) return []
  return arrays.reduce((acc, a) => acc.filter((x) => a.includes(x)))
}

export function StepTwo({
  lists, title, suggested, onSave, onCancel, pending,
}: {
  lists: ListOption[]
  title: string
  suggested: string[]
  onSave: (listIds: string[], repliedYes: boolean, note: string) => void
  onCancel: () => void
  pending: boolean
}) {
  const [listIds, setListIds] = useState(lists.filter((l) => suggested.includes(l.key)).map((l) => l.id))
  const [repliedYes, setRepliedYes] = useState(false)
  const [note, setNote] = useState('')
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm font-medium">{title}</p>
      <MailingListChecklist lists={lists} value={listIds} onChange={setListIds} suggested={suggested} />
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={repliedYes} onChange={(e) => setRepliedYes(e.target.checked)} />
          They asked to be added
        </label>
        <label className="flex flex-1 items-center gap-2">
          <span className="font-medium">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional — e.g. asked at the WIOA conference" className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2" />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button" disabled={pending || listIds.length === 0} onClick={() => onSave(listIds, repliedYes, note)}
          className={`rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white ${pending ? 'cursor-wait opacity-70' : ''}`}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
        {listIds.length === 0 && <span className="self-center text-xs text-muted-foreground">Tick at least one list to save.</span>}
      </div>
    </div>
  )
}
