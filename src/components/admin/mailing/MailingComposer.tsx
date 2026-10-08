'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'
import { renderEmail } from '@/lib/mailing/render'
import { rosterCounts } from '@/lib/mailing/roster'
import {
  saveEdition, createAttachmentUpload, confirmAttachment, removeAttachment, setRecipientsExcluded,
  searchPeopleForEdition, addEditionRecipient, removeAddedRecipient, sendTest, sendNow, scheduleSend,
  cancelSchedule, deleteDraftEdition, refreshRoster, setSkipEarlierVersions, type EditionDraft,
} from '@/app/support/admin/(portal)/crm/mailing/actions'
import { MailingEditor } from './MailingEditor'
import { MailingListChecklist, type ListOption } from './MailingListChecklist'
import { MailingGroupBuilder } from './MailingGroupBuilder'

const WARN_BYTES = 5 * 1024 * 1024
const BUCKET = 'mailing-files'

export interface ComposerEdition {
  id: string
  key: string
  title: string
  isReport: boolean
  reportKey: string | null
  subject: string
  previewText: string | null
  bodyHtml: string
  reportUrl: string | null
  attachFile: boolean
  attachmentName: string | null
  attachmentBytes: number | null
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT'
  scheduledAt: string | null
  listIds: string[]
}

export interface ComposerRecipient {
  id: string
  email: string
  name: string | null
  firstName: string | null
  orgName: string | null
  source: 'BASE' | 'ADDED_THIS_EDITION'
  excluded: boolean
  excludedReason: string | null
  fromListKeys: string[]
  manualSentAt: string | null
}

const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function MailingComposer({
  edition,
  lists,
  recipients: initialRecipients,
  settings,
  fileUrl,
  earlierVersion = null,
}: {
  edition: ComposerEdition
  lists: ListOption[]
  recipients: ComposerRecipient[]
  settings: { fromName: string; fromEmail: string; testEmail: string; footerText: string; postalAddress: string; ratePerHour: number }
  fileUrl: string
  /** Set on version 2 onward: who earlier versions already reached. */
  earlierVersion?: { reachedEmails: string[] } | null
}) {
  const router = useRouter()
  const locked = edition.status !== 'DRAFT'
  const [draft, setDraft] = useState<EditionDraft>({
    title: edition.title, key: edition.key, subject: edition.subject, previewText: edition.previewText ?? '',
    bodyHtml: edition.bodyHtml, isReport: edition.isReport, reportKey: edition.reportKey ?? '',
    reportUrl: edition.reportUrl ?? '', attachFile: edition.attachFile, listIds: edition.listIds,
  })
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const [recipients, setRecipients] = useState(initialRecipients)
  // The server's roster wins whenever it arrives (after a save, an add, a refresh).
  const [serverRecipients, setServerRecipients] = useState(initialRecipients)
  if (serverRecipients !== initialRecipients) {
    setServerRecipients(initialRecipients)
    setRecipients(initialRecipients)
  }
  const [filter, setFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState<'now' | 'schedule' | null>(null)
  const [scheduleAt, setScheduleAt] = useState('')

  const update = <K extends keyof EditionDraft>(k: K, v: EditionDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setDirty(true)
  }

  // Ticked unless someone an earlier version reached is checked on this roster.
  const reached = useMemo(() => new Set(earlierVersion?.reachedEmails ?? []), [earlierVersion])
  const reachedOnRoster = recipients.filter((r) => reached.has(r.email))
  const skipEarlier = reachedOnRoster.every((r) => r.excluded)
  const toggleSkipEarlier = (on: boolean) => {
    setRecipients((rs) => rs.map((r) => {
      if (on && reached.has(r.email) && !r.excluded) return { ...r, excluded: true, excludedReason: 'already_got_version' }
      if (!on && r.excludedReason === 'already_got_version') return { ...r, excluded: false, excludedReason: null }
      return r
    }))
    posthog.capture('mailing_skip_earlier_versions_clicked', { editionId: edition.id, on })
    run(async () => { await setSkipEarlierVersions(edition.id, on) })
  }

  const counts = useMemo(() => rosterCounts(recipients.map((r) => ({ ...r, personId: null, alsoAddToListIds: [], status: 'PENDING' }))), [recipients])
  const listKeyName = useMemo(() => new Map(lists.map((l) => [l.key, l.name])), [lists])

  const save = async (): Promise<boolean> => {
    if (!dirty) return true
    const r = await saveEdition(edition.id, draft)
    setMessage({ ok: r.ok, text: r.message })
    if (r.ok) {
      setDirty(false)
      router.refresh()
    }
    return r.ok
  }

  const run = (fn: () => Promise<void>) => start(async () => { await fn() })

  const reportLink = draft.reportUrl.trim() || (edition.attachmentName ? fileUrl : null)
  const sample = recipients.find((r) => !r.excluded)
  const preview = useMemo(
    () => renderEmail({
      bodyHtml: draft.bodyHtml, previewText: null, reportUrl: reportLink,
      merge: { firstName: sample?.firstName ?? null, orgName: sample?.orgName ?? null, reportUrl: reportLink },
      footerText: settings.footerText, postalAddress: settings.postalAddress || '[your postal address — set it in Sender settings]',
      unsubscribeUrl: '#',
    }).html,
    [draft.bodyHtml, reportLink, sample?.firstName, sample?.orgName, settings.footerText, settings.postalAddress],
  )

  const upload = async (file: File) => {
    setUploading(true)
    setMessage(null)
    try {
      const slot = await createAttachmentUpload(edition.id, file.name, file.size)
      if (!slot.ok) return setMessage({ ok: false, text: slot.message })
      const { error } = await createClient().storage.from(BUCKET).uploadToSignedUrl(slot.path, slot.token, file, { contentType: 'application/pdf' })
      if (error) return setMessage({ ok: false, text: `The upload failed: ${error.message}. Try again.` })
      await confirmAttachment(edition.id, slot.path, file.name, file.size)
      posthog.capture('mailing_attachment_uploaded', { editionId: edition.id, bytes: file.size })
      setMessage({ ok: true, text: `Uploaded ${file.name}.` })
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  const toggle = (ids: string[], excluded: boolean) => {
    setRecipients((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, excluded, excludedReason: excluded ? 'unchecked' : null } : r)))
    run(async () => { await setRecipientsExcluded(edition.id, ids, excluded) })
  }

  const visible = recipients.filter((r) => {
    const q = filter.trim().toLowerCase()
    return !q || r.email.includes(q) || (r.name ?? '').toLowerCase().includes(q) || (r.orgName ?? '').toLowerCase().includes(q)
  })

  return (
    <div className={`space-y-8 ${pending || uploading ? 'cursor-wait' : ''}`}>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg border px-3 py-2 text-sm ${message.ok ? 'border-success/30 bg-success/5' : 'border-destructive/40 bg-destructive/5 text-destructive'}`}>
          {message.text}
        </p>
      )}

      {/* 1. Who it's for */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Send to</h2>
        <MailingListChecklist lists={lists} value={draft.listIds} onChange={(ids) => update('listIds', ids)} disabled={locked} />
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.isReport} disabled={locked} onChange={(e) => update('isReport', e.target.checked)} />
            This is a Displacement Report edition
          </label>
          {draft.isReport && (
            <label className="text-xs">
              <span className="mb-1 block font-medium">Report month</span>
              <input value={draft.reportKey} disabled={locked} onChange={(e) => update('reportKey', e.target.value)} placeholder="2026-10" className="h-8 w-28 rounded border border-input bg-transparent px-2 text-sm" />
            </label>
          )}
          <label className="text-xs">
            <span className="mb-1 block font-medium">Edition key</span>
            <input value={draft.key} disabled={locked} onChange={(e) => update('key', e.target.value)} className="h-8 w-48 rounded border border-input bg-transparent px-2 text-sm" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium">Name (only you see this)</span>
            <input value={draft.title} disabled={locked} onChange={(e) => update('title', e.target.value)} className="h-8 w-72 rounded border border-input bg-transparent px-2 text-sm" />
          </label>
        </div>
      </section>

      {/* 2. The email */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The email</h2>
        <p className="text-xs text-muted-foreground">
          From {settings.fromName} &lt;{settings.fromEmail}&gt;. Replies go to your inbox. Each person gets their own copy; nobody sees the list.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Subject</span>
              <input value={draft.subject} disabled={locked} onChange={(e) => update('subject', e.target.value)} className="h-10 w-full rounded-lg border border-input bg-transparent px-3" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Preview line <span className="font-normal text-muted-foreground">optional — the grey text inboxes show after the subject</span></span>
              <input value={draft.previewText} disabled={locked} onChange={(e) => update('previewText', e.target.value)} className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm" />
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-medium">Message</span>
              <MailingEditor initialHtml={edition.bodyHtml} onChange={(html) => update('bodyHtml', html)} disabled={locked} />
              <p className="mt-1 text-xs text-muted-foreground">
                &ldquo;Justin&rdquo; is added at the end unless you sign it yourself. {'{{firstName}}'} becomes &ldquo;there&rdquo; when there&apos;s no name.
              </p>
            </div>

            {/* Attachment */}
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Report file</p>
              {edition.attachmentName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="text-brand underline">{edition.attachmentName}</a>
                  {edition.attachmentBytes != null && <span className="text-xs text-muted-foreground">{fmtBytes(edition.attachmentBytes)}</span>}
                  {!locked && (
                    <>
                      <label className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                        Replace
                        <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                      </label>
                      <button type="button" onClick={() => run(async () => { await removeAttachment(edition.id); router.refresh() })} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                        Remove file
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <label className={`inline-block rounded-md border border-dashed border-border px-3 py-2 text-xs hover:bg-muted ${locked ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                  {uploading ? 'Uploading…' : 'Upload the PDF'}
                  <input type="file" accept="application/pdf" className="sr-only" disabled={locked || uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                The email links to the file on the site{reportLink ? <> (<span className="break-all">{reportLink}</span>)</> : ''} — better for delivery, and clicks are counted.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={draft.attachFile} disabled={locked || !edition.attachmentName} onChange={(e) => update('attachFile', e.target.checked)} />
                Also attach the PDF to the email
              </label>
              {!edition.attachmentName && <p className="text-xs text-muted-foreground">Upload a file to be able to attach it.</p>}
              {draft.attachFile && (edition.attachmentBytes ?? 0) > WARN_BYTES && (
                <p className="text-xs text-orange">This file is {fmtBytes(edition.attachmentBytes!)}. Attachments over 5 MB often land in spam or get rejected; the link alone is safer.</p>
              )}
              <label className="block text-xs">
                <span className="mb-1 block font-medium">Or link somewhere else instead <span className="font-normal text-muted-foreground">optional</span></span>
                <input value={draft.reportUrl} disabled={locked} onChange={(e) => update('reportUrl', e.target.value)} placeholder="https://launchyournextchapter.com/reports/…" className="h-8 w-full rounded border border-input bg-transparent px-2 text-sm" />
              </label>
            </div>

            {!locked && (
              <button
                type="button" disabled={pending || !dirty} onClick={() => run(async () => { await save() })}
                className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted ${pending ? 'cursor-wait' : ''}`}
                title={dirty ? undefined : 'Nothing has changed since the last save'}
              >
                {pending ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
              </button>
            )}
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">What {sample?.firstName ?? 'they'} will see</p>
            <div className="rounded-lg border border-border bg-white p-4 text-black">
              <p className="mb-3 border-b border-neutral-200 pb-2 text-sm"><span className="text-neutral-500">Subject:</span> {draft.subject || <em className="text-neutral-400">no subject yet</em>}</p>
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Recipients */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recipients</h2>
            <p className="text-sm text-muted-foreground">
              {counts.base} on the lists − {counts.excluded} unchecked + {counts.added} added for this send ={' '}
              <span className="font-semibold text-foreground">{counts.total} will get it</span>
            </p>
            <p className="text-xs text-muted-foreground">Unchecking someone skips them this time only; they stay on the list.</p>
          </div>
          {!locked && (
            <button type="button" onClick={() => run(async () => { if (await save()) { await refreshRoster(edition.id); router.refresh() } })} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
              Refresh from the lists
            </button>
          )}
        </div>

        {earlierVersion && (
          <label className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${skipEarlier ? 'border-brand/40 bg-brand/5' : 'border-border'}`}>
            <input type="checkbox" checked={skipEarlier} disabled={locked} onChange={(e) => toggleSkipEarlier(e.target.checked)} />
            <span className="font-medium">Leave out anyone an earlier version already emailed</span>
            <span className="text-xs text-muted-foreground">
              {reached.size === 0
                ? 'No earlier version has gone out yet.'
                : `${reached.size} reached by earlier versions · ${reachedOnRoster.length} of them on this roster${skipEarlier ? ', unchecked' : ', checked'}`}
            </span>
          </label>
        )}

        {!locked && <MailingGroupBuilder editionId={edition.id} lists={lists} defaultListIds={draft.listIds} skipEarlierVersions={!!earlierVersion && skipEarlier} />}

        {!locked && <AddPerson editionId={edition.id} lists={lists} targetListIds={draft.listIds} onAdded={() => router.refresh()} onMessage={setMessage} />}

        <div className="flex flex-wrap items-center gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, email or organization" aria-label="Filter recipients" className="h-8 w-72 rounded border border-input bg-transparent px-2 text-sm" />
          {!locked && visible.length > 0 && (
            <>
              <button type="button" onClick={() => toggle(visible.map((r) => r.id), false)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Check all shown</button>
              <button type="button" onClick={() => toggle(visible.map((r) => r.id), true)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Uncheck all shown</button>
            </>
          )}
        </div>

        {recipients.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nobody is on {draft.listIds.length ? 'these lists' : 'the roster'} yet. Add people to the lists, or add someone for this send above.
          </p>
        ) : (
          <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="w-8 px-3 py-2"><span className="sr-only">Send</span></th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const manual = r.excludedReason === 'already_sent_manually'
                  return (
                    <tr key={r.id} className={`border-t border-border ${r.excluded ? 'text-muted-foreground' : ''}`}>
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={!r.excluded} disabled={locked} onChange={() => toggle([r.id], !r.excluded)} aria-label={`Send to ${r.name ?? r.email}`} />
                      </td>
                      <td className="px-3 py-1.5">{r.name ?? '—'}{r.orgName && <span className="block text-xs text-muted-foreground">{r.orgName}</span>}</td>
                      <td className="px-3 py-1.5">{r.email}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex flex-wrap gap-1">
                          {r.source === 'ADDED_THIS_EDITION' && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">added for this send</span>}
                          {r.fromListKeys.map((k) => <span key={k} className="rounded-full bg-muted px-1.5 py-0.5 text-[11px]">{listKeyName.get(k) ?? k}</span>)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {manual && r.manualSentAt ? `Already sent manually on ${fmtDate(r.manualSentAt)}` : manual ? 'Already sent manually' : ''}
                        {r.excludedReason === 'already_got_version' && (r.manualSentAt ? `Got another version on ${fmtDate(r.manualSentAt)}` : 'Got another version')}
                        {r.excludedReason === 'unsubscribed' && 'Unsubscribed'}
                        {r.excludedReason === 'suppressed' && 'Address bounced or complained'}
                        {r.source === 'ADDED_THIS_EDITION' && !locked && (
                          <button type="button" onClick={() => run(async () => { await removeAddedRecipient(edition.id, r.id); setRecipients((rs) => rs.filter((x) => x.id !== r.id)) })} className="ml-2 text-xs text-muted-foreground underline">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Send */}
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold">Send</h2>
        {edition.status === 'SCHEDULED' && edition.scheduledAt ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Scheduled for {new Date(edition.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}, to {counts.total} people.</span>
            <button type="button" onClick={() => run(async () => { await cancelSchedule(edition.id); router.refresh() })} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
              Cancel the schedule
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Sends go out at up to {settings.ratePerHour} an hour, one email per person.
              {!settings.postalAddress && ' Add your postal address in Sender settings before sending — it has to be in every list email.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button" disabled={pending}
                onClick={() => run(async () => {
                  if (!(await save())) return
                  const r = await sendTest(edition.id)
                  setMessage({ ok: r.ok, text: r.message })
                  posthog.capture('mailing_test_clicked', { editionId: edition.id, ok: r.ok })
                })}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                Send test to me ({settings.testEmail})
              </button>
              <button
                type="button" disabled={pending || counts.total === 0}
                onClick={() => setConfirming('now')}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                title={counts.total === 0 ? 'Nobody is on the roster yet' : undefined}
              >
                Review and approve ({counts.total})
              </button>
              <button type="button" disabled={pending || counts.total === 0} onClick={() => setConfirming('schedule')} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                Schedule…
              </button>
              {counts.total === 0 && <span className="text-xs text-muted-foreground">Nobody is on the roster yet — add a group or people above.</span>}
            </div>
            {confirming && (
              <div role="dialog" aria-label="Confirm send" className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
                <p className="font-medium">Approve this send</p>
                <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Subject</dt><dd>{draft.subject || 'untitled'}</dd>
                  <dt className="text-muted-foreground">Lists</dt><dd>{lists.filter((l) => draft.listIds.includes(l.id)).map((l) => l.name).join(', ') || 'none'}</dd>
                  <dt className="text-muted-foreground">Readership</dt>
                  <dd>{counts.base} on the lists − {counts.excluded} left out + {counts.added} added = <b>{counts.total} {counts.total === 1 ? 'person' : 'people'}</b></dd>
                  <dt className="text-muted-foreground">When</dt><dd>{confirming === 'now' ? 'Now' : 'At the time below'}</dd>
                </dl>
                {confirming === 'schedule' && (
                  <label className="block text-xs">
                    <span className="mb-1 block font-medium">When</span>
                    <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-8 rounded border border-input bg-background px-2 text-sm" />
                  </label>
                )}
                <div className="flex gap-2">
                  <button
                    type="button" disabled={pending}
                    onClick={() => run(async () => {
                      if (!(await save())) return
                      const r = confirming === 'now'
                        ? await sendNow(edition.id, counts.total)
                        : await scheduleSend(edition.id, counts.total, scheduleAt ? new Date(scheduleAt).toISOString() : '')
                      setMessage({ ok: r.ok, text: r.message })
                      if (r.ok) { setConfirming(null); router.refresh() }
                    })}
                    className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    {pending ? 'Working…' : confirming === 'now' ? `Approve and send to ${counts.total}` : 'Approve and schedule'}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
            {edition.status === 'DRAFT' && (
              <DeleteDraft onDelete={() => run(async () => { await deleteDraftEdition(edition.id) })} />
            )}
          </>
        )}
      </section>
    </div>
  )
}

function DeleteDraft({ onDelete }: { onDelete: () => void }) {
  const [sure, setSure] = useState(false)
  return sure ? (
    <p className="flex items-center gap-2 border-t border-border pt-3 text-xs">
      <span className="text-destructive">Delete this draft and its uploaded file?</span>
      <button type="button" onClick={onDelete} className="rounded-md border border-destructive/50 px-2 py-1 text-destructive hover:bg-destructive/10">Yes, delete</button>
      <button type="button" onClick={() => setSure(false)} className="rounded-md border border-border px-2 py-1">Keep it</button>
    </p>
  ) : (
    <p className="border-t border-border pt-3">
      <button type="button" onClick={() => setSure(true)} className="text-xs text-muted-foreground underline">Delete draft</button>
    </p>
  )
}

function AddPerson({
  editionId, lists, targetListIds, onAdded, onMessage,
}: {
  editionId: string
  lists: ListOption[]
  targetListIds: string[]
  onAdded: () => void
  onMessage: (m: { ok: boolean; text: string }) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; email: string; org: string | null }[]>([])
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [alsoAdd, setAlsoAdd] = useState(false)
  const [alsoLists, setAlsoLists] = useState<string[]>(targetListIds)
  const [pending, start] = useTransition()

  const search = (value: string) => {
    setQ(value)
    setPicked(null)
    if (value.trim().length < 2) return setResults([])
    start(async () => setResults(await searchPeopleForEdition(value)))
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Add people for this send</span>
        <input value={q} onChange={(e) => search(e.target.value)} placeholder="Search the CRM by name, email or organization" className="h-8 w-full max-w-md rounded border border-input bg-transparent px-2 text-sm" />
      </label>
      {!picked && results.length > 0 && (
        <ul className="max-w-md divide-y divide-border rounded border border-border text-sm">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { setPicked({ id: p.id, name: p.name }); setResults([]); setAlsoLists(targetListIds) }} className="w-full px-2 py-1.5 text-left hover:bg-muted">
                {p.name} <span className="text-xs text-muted-foreground">{p.email}{p.org ? ` · ${p.org}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!picked && q.trim().length >= 2 && results.length === 0 && !pending && (
        <p className="text-xs text-muted-foreground">Nobody with an email address matches. Add their email on their CRM page first.</p>
      )}
      {picked && (
        <div className={`space-y-2 ${pending ? 'cursor-wait' : ''}`}>
          <p className="text-sm">Add <span className="font-medium">{picked.name}</span> to this send.</p>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={alsoAdd} onChange={(e) => setAlsoAdd(e.target.checked)} />
            Also add them to list(s) once it&apos;s sent
          </label>
          {alsoAdd && <MailingListChecklist lists={lists} value={alsoLists} onChange={setAlsoLists} />}
          <div className="flex gap-2">
            <button
              type="button" disabled={pending}
              onClick={() => start(async () => {
                const r = await addEditionRecipient(editionId, picked.id, alsoAdd ? alsoLists : [])
                onMessage({ ok: r.ok, text: r.message })
                if (r.ok) { setPicked(null); setQ(''); onAdded() }
              })}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              {pending ? 'Adding…' : 'Add to this send'}
            </button>
            <button type="button" onClick={() => setPicked(null)} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
