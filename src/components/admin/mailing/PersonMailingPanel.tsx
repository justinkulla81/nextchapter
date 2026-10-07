'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { addPersonToLists, removePersonFromList, markReportReceived, unmarkReportReceived } from '@/app/support/admin/(portal)/crm/mailing/actions'
import type { ListOption } from './MailingListChecklist'
import { StepTwo } from './MailingPromptQueue'

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Subscribed', cls: 'bg-success/10 text-success' },
  UNSUBSCRIBED: { label: 'Unsubscribed', cls: 'bg-muted text-muted-foreground' },
  BOUNCED: { label: 'Bounced', cls: 'bg-destructive/10 text-destructive' },
  COMPLAINED: { label: 'Marked as spam', cls: 'bg-destructive/10 text-destructive' },
}
const VIA: Record<string, string> = {
  WEBSITE_SIGNUP: 'signed up on the site', ADDED_BY_ADMIN: 'added by you', REPLIED_YES: 'asked to be added', IMPORT: 'imported',
}
const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', LINKEDIN: 'LinkedIn', IN_PERSON: 'In person', OTHER: 'Other' }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export interface PersonMembership { listId: string; listName: string; status: string; addedVia: string; addedAt: string; consentNote: string | null }
export interface PersonReportSend { editionKey: string; method: 'AUTOMATED' | 'MANUAL'; channel: string; sentAt: string; openedAt: string | null; clickedAt: string | null; repliedAt: string | null }

export function PersonMailingPanel({
  personId, hasEmail, memberships, lists, suggested, reportSends, reportKeys, suppressed,
}: {
  personId: string
  hasEmail: boolean
  memberships: PersonMembership[]
  lists: ListOption[]
  suggested: string[]
  reportSends: PersonReportSend[]
  /** Recent report months to offer, newest first. */
  reportKeys: string[]
  suppressed: string | null
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [marking, setMarking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [key, setKey] = useState(reportKeys[0] ?? '')
  const [channel, setChannel] = useState('EMAIL')
  const onKeys = new Set(memberships.map((m) => lists.find((l) => l.id === m.listId)?.key).filter(Boolean))
  const addable = lists.filter((l) => !memberships.some((m) => m.listId === l.id))

  return (
    <div className={`grid gap-6 lg:grid-cols-2 ${pending ? 'cursor-wait' : ''}`}>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Mailing lists</h3>
        {suppressed && <p className="text-xs text-destructive">This address {suppressed === 'COMPLAINED' ? 'marked a list email as spam' : 'bounced'} — it is never mailed again.</p>}
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not on any list.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {memberships.map((m) => (
              <li key={m.listId} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <span className="font-medium">{m.listName}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${STATUS[m.status]?.cls}`}>{STATUS[m.status]?.label ?? m.status}</span>
                <span className="text-xs text-muted-foreground" title={m.consentNote ?? ''}>{fmt(m.addedAt)}, {VIA[m.addedVia] ?? m.addedVia}</span>
                {m.status === 'ACTIVE' && (
                  <button
                    type="button" className="ml-auto text-xs text-muted-foreground underline"
                    onClick={() => start(async () => { await removePersonFromList(personId, m.listId); posthog.capture('mailing_person_removed_clicked', { personId, listId: m.listId }); router.refresh() })}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
        {!hasEmail ? (
          <p className="text-xs text-muted-foreground">Add an email address to put them on a list.</p>
        ) : adding ? (
          <StepTwo
            lists={addable}
            title="Add to:"
            suggested={suggested.filter((k) => !onKeys.has(k))}
            pending={pending}
            onCancel={() => setAdding(false)}
            onSave={(listIds, repliedYes, note) => start(async () => {
              const r = await addPersonToLists(personId, listIds, { repliedYes, note })
              posthog.capture('mailing_person_added_clicked', { personId, lists: listIds.length, repliedYes })
              setMessage(r.message); setAdding(false); router.refresh()
            })}
          />
        ) : addable.length > 0 ? (
          <button type="button" onClick={() => setAdding(true)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Add to lists…</button>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Displacement Report</h3>
        {reportSends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No edition recorded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {reportSends.map((s) => (
              <li key={s.editionKey} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <span className="font-medium">{s.editionKey}</span>
                <span title={s.method === 'AUTOMATED' ? 'Sent by the system' : 'Sent by you'}>{s.method === 'AUTOMATED' ? '✉︎ automated' : `✋ manual · ${CHANNEL_LABEL[s.channel] ?? s.channel}`}</span>
                <span className="text-xs text-muted-foreground">
                  {fmt(s.sentAt)}
                  {s.clickedAt ? ' · clicked' : s.openedAt ? ' · opened (approx.)' : ''}
                  {s.repliedAt ? ' · replied' : ''}
                </span>
                {s.method === 'MANUAL' && (
                  <button type="button" className="ml-auto text-xs text-muted-foreground underline" onClick={() => start(async () => { await unmarkReportReceived(personId, s.editionKey); router.refresh() })}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {marking ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <label>
              <span className="mb-1 block font-medium">Edition</span>
              <input list="report-keys" value={key} onChange={(e) => setKey(e.target.value)} placeholder="2026-09" className="h-8 w-28 rounded border border-input bg-background px-2 text-sm" />
              <datalist id="report-keys">{reportKeys.map((k) => <option key={k} value={k} />)}</datalist>
            </label>
            <div role="group" aria-label="How" className="flex gap-1">
              {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setChannel(v)} aria-pressed={channel === v} className={`rounded-md border px-2 py-1 ${channel === v ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
            <button
              type="button" disabled={pending}
              onClick={() => start(async () => {
                const r = await markReportReceived([personId], key, channel)
                posthog.capture('report_mark_received_clicked', { personId, editionKey: key, channel, ok: r.ok })
                setMessage(r.message); if (r.ok) setMarking(false); router.refresh()
              })}
              className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white"
            >
              Mark as received
            </button>
            <button type="button" onClick={() => setMarking(false)} className="rounded-md border border-border px-3 py-1.5">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setMarking(true)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Mark as received…</button>
        )}
      </div>
    </div>
  )
}
