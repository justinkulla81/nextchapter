'use client'

import { useState } from 'react'
import { Check, Lock, Sparkles, Video } from 'lucide-react'
import { Chip, Section } from '@/components/candidate/ui'
import { ShowMore } from '@/components/candidate/ShowMore'
import { usePostHog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { COACH_TOPICS, topicByKey } from '@/lib/coach/topics'
import { CAPTURE_KINDS, CAPTURE_LABELS, MAX_CAPTURE_CHARS, MAX_FOLLOW_UP_CHARS, type CaptureKind, type OwnerKind } from '@/lib/coach/session-notes'
import {
  addCaptureAction,
  addFollowUpAction,
  draftSummaryAction,
  fetchMeetNotesAction,
  pasteNotesAction,
  removeCaptureAction,
  removeFollowUpAction,
  savePrivateNotesAction,
  saveSummaryAction,
  sendToMemberAction,
  setCoachFollowUpDoneAction,
  setTopicAction,
  updateFollowUpAction,
} from '@/app/support/coach/(app)/clients/[token]/[clientId]/notes/actions'
import { busy, ChoiceButtons, ConfirmRemove, PrimaryAction, SecondaryAction, StatusLine, useAct } from './controls'

// The coach's session notes: capture, summary and follow-ups first; topics and earlier steps behind "Show more";
// one primary action, "Send to <name>", with a plain statement of what the member receives and what is not sent.
// Built to match src/app/dev-preview/_mockups/coach-session.tsx (CoachSessionNotes).

export interface WorkspaceData {
  token: string
  clientId: string
  sessionId: string
  memberFirstName: string
  coachFirstName: string
  sent: boolean
  sentAtLabel: string | null
  privateNotes: string
  captures: { id: string; kind: CaptureKind; text: string; createdAt: string }[]
  summary: { text: string; state: 'DRAFT' | 'REVIEWED' | 'SENT'; aiDrafted: boolean; hasMeetNotes: boolean } | null
  followUps: { id: string; ownerKind: OwnerKind; text: string; dueOn: string | null; status: 'open' | 'done' }[]
  topics: { id: string; topic: string; label: string; quote: string | null; status: 'suggested' | 'confirmed' | 'accepted' | 'dismissed' }[]
  earlierOpen: { id: string; ownerKind: OwnerKind; text: string; dueLabel: string | null }[]
  memberSharesProgress: boolean
  manifest: { receives: string[]; notSent: string; blockedReason: string | null }
}

type Ids = { token: string; clientId: string; sessionId: string }

// ── Capture ──────────────────────────────────────────────────────────────────

function CaptureSection({ ids, d }: { ids: Ids; d: WorkspaceData }) {
  const { pending, notice, act } = useAct()
  const posthog = usePostHog()
  const [kind, setKind] = useState<CaptureKind | null>(null)
  const [text, setText] = useState('')
  const [priv, setPriv] = useState(d.privateNotes)
  const priv2 = useAct()
  const locked = d.sent
  return (
    <Section id="capture" title="Capture">
      <div className={cn('space-y-3', busy(pending))}>
        <ChoiceButtons
          label="What are you capturing"
          value={kind}
          disabled={locked}
          options={CAPTURE_KINDS.map((k) => ({ value: k, label: CAPTURE_LABELS[k] }))}
          onChange={(k) => {
            setKind(k)
            posthog?.capture('coach_capture_kind_selected', { sessionId: ids.sessionId, kind: k })
          }}
        />
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!kind) return
            act(() => addCaptureAction(ids.token, ids.clientId, ids.sessionId, kind, text), () => setText(''))
          }}
        >
          <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
            <span className="sr-only">What happened</span>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_CAPTURE_CHARS} disabled={locked} placeholder={kind ? `Add a ${CAPTURE_LABELS[kind].toLowerCase()}` : 'Choose a kind above, then write one line'} className="h-10 w-full rounded-lg border border-border px-3 text-base font-normal disabled:opacity-60" />
          </label>
          <SecondaryAction type="submit" disabled={locked || !kind || !text.trim() || pending}>Add capture</SecondaryAction>
        </form>
        {!kind && !locked && <p className="text-xs text-muted-foreground">Pick Win, Blocker, Decision or Next step first so each line is filed under what it is.</p>}
        <StatusLine notice={notice} />
        {d.captures.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing captured yet. One line per win, blocker, decision or next step is enough for a good draft.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {d.captures.map((c) => (
              <li key={c.id} className="flex items-start gap-3 p-4">
                <Chip tone="muted">{CAPTURE_LABELS[c.kind]}</Chip>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-ink">{c.text}</p>
                  {!locked && <ConfirmRemove what="capture" disabled={pending} onConfirm={() => act(() => removeCaptureAction(ids.token, ids.clientId, ids.sessionId, c.id))} />}
                </div>
                <time dateTime={c.createdAt} suppressHydrationWarning className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cn('space-y-2', busy(priv2.pending))}>
        <label className="block text-sm font-semibold text-ink">
          Your private notes
          <textarea value={priv} onChange={(e) => setPriv(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base font-normal" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryAction disabled={priv2.pending || priv === d.privateNotes} onClick={() => priv2.act(() => savePrivateNotesAction(ids.token, ids.clientId, ids.sessionId, priv))}>Save private notes</SecondaryAction>
          <StatusLine notice={priv2.notice} />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" aria-hidden /> Private notes stay with you. They are never part of the summary or anything {d.memberFirstName} receives.</p>
      </div>
    </Section>
  )
}

// ── Summary ──────────────────────────────────────────────────────────────────

function SummarySection({ ids, d }: { ids: Ids; d: WorkspaceData }) {
  const serverText = d.summary?.text ?? ''
  const [text, setText] = useState(serverText)
  const [seen, setSeen] = useState(serverText)
  // When the server's text changes (a new draft, a save) the box shows it.
  if (seen !== serverText) {
    setSeen(serverText)
    setText(serverText)
  }
  const save = useAct()
  const draft = useAct()
  const notes = useAct()
  const posthog = usePostHog()
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const locked = d.sent
  const dirty = text !== serverText
  const hasEdits = Boolean(text.trim()) && (dirty || d.summary?.state === 'REVIEWED')
  const state = d.summary?.state
  const meta = !d.summary?.text ? 'No summary yet' : d.sent ? 'Sent' : state === 'REVIEWED' ? 'Edited by you' : d.summary.aiDrafted ? 'Drafted by AI, not edited yet' : 'Not edited yet'
  const startDraft = (replace: boolean) => {
    setConfirmReplace(false)
    draft.act(() => draftSummaryAction(ids.token, ids.clientId, ids.sessionId, replace))
  }

  return (
    <Section id="draft" title={`Summary for ${d.memberFirstName}`}>
      <div className="space-y-3 rounded-2xl border border-border p-5">
        <div className={cn('space-y-2', busy(notes.pending))}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Video className="size-4" aria-hidden />{d.summary?.hasMeetNotes ? 'Call notes added. They are used for the draft and are not sent.' : 'Add the call notes to make the draft better.'}</div>
            {!locked && (
              <div className="flex flex-wrap gap-2">
                <SecondaryAction disabled={notes.pending} onClick={() => notes.act(() => fetchMeetNotesAction(ids.token, ids.clientId, ids.sessionId))}>Add the Gemini notes</SecondaryAction>
                <SecondaryAction
                  onClick={() => {
                    setPasting((v) => !v)
                    posthog?.capture('coach_paste_notes_toggled', { sessionId: ids.sessionId })
                  }}
                >
                  Paste notes
                </SecondaryAction>
              </div>
            )}
          </div>
          {pasting && !locked && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">
                Notes from the call
                <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base font-normal" placeholder="Paste the summary and next steps. Not a full transcript." />
              </label>
              <SecondaryAction disabled={notes.pending || !pasted.trim()} onClick={() => notes.act(() => pasteNotesAction(ids.token, ids.clientId, ids.sessionId, pasted), () => { setPasted(''); setPasting(false) })}>Add these notes</SecondaryAction>
            </div>
          )}
          <p className="text-xs text-muted-foreground">We use Gemini’s notes or notes you paste, never the full transcript.</p>
          <StatusLine notice={notes.notice} />
        </div>

        <div className={cn('space-y-2', busy(draft.pending || save.pending))}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4" aria-hidden /> Drafted from your captures and the call notes. Edit anything.</p>
            {!locked &&
              (confirmReplace ? (
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink">Replace what you wrote with a new draft?</span>
                  <button type="button" autoFocus onClick={() => setConfirmReplace(false)} className="rounded-md border border-border px-2 py-1 font-semibold text-ink">Keep my text</button>
                  <button type="button" onClick={() => startDraft(true)} className="rounded-md px-2 py-1 font-semibold text-ink underline underline-offset-4">Yes, replace it</button>
                </span>
              ) : (
                <SecondaryAction disabled={draft.pending} onClick={() => (hasEdits ? setConfirmReplace(true) : startDraft(false))}>{draft.pending ? 'Drafting…' : d.summary?.text ? 'Write a new draft' : 'Draft a summary'}</SecondaryAction>
              ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={locked} rows={8} aria-label={`Summary for ${d.memberFirstName}`} placeholder={`Write what you want ${d.memberFirstName} to read, or draft one from your captures.`} className="w-full rounded-lg border border-border px-3 py-2 text-base leading-relaxed" />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{meta}</span>
            {!locked && <SecondaryAction disabled={save.pending || !dirty} onClick={() => save.act(() => saveSummaryAction(ids.token, ids.clientId, ids.sessionId, text))}>Save summary</SecondaryAction>}
          </div>
          <StatusLine notice={draft.notice} />
          <StatusLine notice={save.notice} />
        </div>
      </div>
    </Section>
  )
}

// ── Follow-ups ───────────────────────────────────────────────────────────────

function FollowUpsSection({ ids, d }: { ids: Ids; d: WorkspaceData }) {
  const { pending, notice, act } = useAct()
  const [text, setText] = useState('')
  const [owner, setOwner] = useState<OwnerKind>('member')
  const [due, setDue] = useState('')
  const locked = d.sent
  const ownerOptions: { value: OwnerKind; label: string }[] = [{ value: 'coach', label: 'You' }, { value: 'member', label: d.memberFirstName }]
  return (
    <Section id="followups" title="Follow-ups">
      <div className={cn('space-y-3', busy(pending))}>
        {d.followUps.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No follow-ups yet. Each needs one owner and, if you can, a date.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {d.followUps.map((f) => (
              <li key={f.id} className="space-y-2 p-4">
                <p className="text-base font-semibold text-ink">{f.text}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ChoiceButtons size="sm" label={`Owner of: ${f.text}`} value={f.ownerKind} disabled={locked} options={ownerOptions} onChange={(v) => act(() => updateFollowUpAction(ids.token, ids.clientId, ids.sessionId, f.id, { ownerKind: v }))} />
                  <label className="text-xs font-semibold text-ink">
                    <span className="sr-only">Due date</span>
                    <input type="date" defaultValue={f.dueOn ?? ''} disabled={locked} aria-label={`Due date for ${f.text}`} onBlur={(e) => e.target.value !== (f.dueOn ?? '') && act(() => updateFollowUpAction(ids.token, ids.clientId, ids.sessionId, f.id, { dueOn: e.target.value }))} className="rounded-lg border border-border px-2 py-1 text-xs" />
                  </label>
                </div>
                {!locked && <ConfirmRemove what="follow-up" disabled={pending} onConfirm={() => act(() => removeFollowUpAction(ids.token, ids.clientId, ids.sessionId, f.id))} />}
              </li>
            ))}
          </ul>
        )}
        {!locked && (
          <form
            className="space-y-2 rounded-2xl border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault()
              act(() => addFollowUpAction(ids.token, ids.clientId, ids.sessionId, owner, text, due), () => { setText(''); setDue('') })
            }}
          >
            <label className="block text-sm font-semibold text-ink">
              Add a follow-up
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_FOLLOW_UP_CHARS} placeholder="Start with a verb: Send, Write, Decide" className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-base font-normal" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <ChoiceButtons size="sm" label="Who owns it" value={owner} options={ownerOptions} onChange={setOwner} />
              <label className="text-xs font-semibold text-ink"><span className="sr-only">Due date</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="rounded-lg border border-border px-2 py-1 text-xs" /></label>
              <SecondaryAction type="submit" disabled={pending || !text.trim()}>Add follow-up</SecondaryAction>
            </div>
          </form>
        )}
        <StatusLine notice={notice} />
        <p className="text-sm text-muted-foreground">Why: each one has one owner and a date, so nobody has to remember who owes what. {d.memberFirstName}’s go into their plan; yours are shown to them with your name so they can see you are doing it.</p>
      </div>
    </Section>
  )
}

// ── Topics and earlier steps (behind Show more) ──────────────────────────────

function TopicsBlock({ ids, d }: { ids: Ids; d: WorkspaceData }) {
  const { pending, notice, act } = useAct()
  const [pick, setPick] = useState('')
  const used = new Set(d.topics.map((t) => t.topic))
  const choices = COACH_TOPICS.filter((t) => !used.has(t.key))
  const locked = d.sent
  return (
    <Section id="interests" title={`Topics ${d.memberFirstName} wants help with`}>
      <div className={cn('space-y-3', busy(pending))}>
        {d.topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No topics found yet. Draft a summary and we suggest the ones {d.memberFirstName} mentioned, or add one yourself.</p>
        ) : (
          <ul className="space-y-2">
            {d.topics.map((t) => {
              const on = t.status !== 'suggested'
              return (
                <li key={t.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', on ? 'bg-ink text-white' : 'bg-muted text-ink')}>{on && <Check className="size-3.5" aria-hidden />}{t.label}</span>
                    {locked ? (
                      <span className="text-xs font-medium text-muted-foreground">{t.status === 'accepted' ? 'Accepted' : t.status === 'dismissed' ? 'Dismissed' : t.status === 'confirmed' ? 'Sent, waiting for a choice' : 'Not sent'}</span>
                    ) : (
                      <SecondaryAction label={on ? `Take back ${t.label}` : `Confirm ${t.label}`} disabled={pending} onClick={() => act(() => setTopicAction(ids.token, ids.clientId, ids.sessionId, t.topic, !on))}>{on ? 'Take back' : 'Confirm'}</SecondaryAction>
                    )}
                  </div>
                  {t.quote && <p className="mt-1.5 text-sm text-muted-foreground">They said: {t.quote}</p>}
                </li>
              )
            })}
          </ul>
        )}
        {!locked && choices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-ink">
              <span className="sr-only">Add a topic</span>
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal">
                <option value="">Add a topic…</option>
                {choices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            <SecondaryAction disabled={!pick || pending} onClick={() => act(() => setTopicAction(ids.token, ids.clientId, ids.sessionId, pick, true), () => setPick(''))}>Confirm this topic</SecondaryAction>
          </div>
        )}
        <StatusLine notice={notice} />
        <p className="text-sm text-muted-foreground">Why: topics you confirm go to {d.memberFirstName}, who accepts or dismisses each one. Accepting changes their learning plan right away.{pick && topicByKey(pick) ? ` ${topicByKey(pick)!.effect}` : ''}</p>
      </div>
    </Section>
  )
}

function EarlierBlock({ ids, d }: { ids: Ids; d: WorkspaceData }) {
  const { pending, notice, act } = useAct()
  return (
    <Section id="earlier" title="Still open from earlier sessions">
      <div className={cn('space-y-3', busy(pending))}>
        {!d.memberSharesProgress ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden />{d.memberFirstName} has not shared their progress with you, so you see what you agreed, not whether they did it.</p>
        ) : d.earlierOpen.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is open from earlier sessions.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {d.earlierOpen.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="text-base font-semibold text-ink">{f.text}</p><p className="text-sm text-muted-foreground">{f.ownerKind === 'coach' ? 'Yours' : `${d.memberFirstName}’s`}{f.dueLabel ? ` · due ${f.dueLabel}` : ''}</p></div>
                {f.ownerKind === 'coach' && <SecondaryAction label={`Mark done: ${f.text}`} disabled={pending} onClick={() => act(() => setCoachFollowUpDoneAction(ids.token, ids.clientId, ids.sessionId, f.id, true))}>Mark done</SecondaryAction>}
              </li>
            ))}
          </ul>
        )}
        <StatusLine notice={notice} />
        <p className="text-sm text-muted-foreground">Why: open steps from your last notes, checked against what {d.memberFirstName} marked done in their plan.</p>
      </div>
    </Section>
  )
}

// ── Send ─────────────────────────────────────────────────────────────────────

function SendCard({ ids, d }: { ids: Ids; d: WorkspaceData }) {
  const { pending, notice, act } = useAct()
  const hint = 'send-hint'
  return (
    <div className={cn('space-y-3 rounded-2xl border border-ink/30 p-5', busy(pending))}>
      <h2 className="font-display text-lg font-semibold text-ink">{d.sent ? `Sent to ${d.memberFirstName}` : `What ${d.memberFirstName} will receive`}</h2>
      {d.sent ? (
        <p className="text-sm text-ink">{d.memberFirstName} has it in their plan{d.sentAtLabel ? ` since ${d.sentAtLabel}` : ''}. This summary can no longer be changed.</p>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm text-ink">
            {d.manifest.receives.map((line) => <li key={line} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{line}</li>)}
            <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><span className="text-muted-foreground">{d.manifest.notSent}</span></li>
          </ul>
          <p className="text-sm text-muted-foreground">{d.memberFirstName} gets it in their NextChapter plan, and an email that says there is an update and links to it. The email has none of the summary text.</p>
          <PrimaryAction pending={pending} pendingLabel="Sending…" disabled={d.manifest.blockedReason !== null} describedBy={hint} onClick={() => act(() => sendToMemberAction(ids.token, ids.clientId, ids.sessionId))}>{`Send to ${d.memberFirstName}`}</PrimaryAction>
          <p id={hint} className="text-sm text-muted-foreground">{d.manifest.blockedReason ?? 'Nothing reaches them until you press this.'}</p>
        </>
      )}
      <StatusLine notice={notice} />
    </div>
  )
}

export function SessionNotesWorkspace({ data }: { data: WorkspaceData }) {
  const ids: Ids = { token: data.token, clientId: data.clientId, sessionId: data.sessionId }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-8">
        <CaptureSection ids={ids} d={data} />
        <SummarySection ids={ids} d={data} />
        <ShowMore page="coach_session_notes" label={`Topics and earlier steps`} properties={{ sessionId: data.sessionId }}>
          <TopicsBlock ids={ids} d={data} />
          <EarlierBlock ids={ids} d={data} />
        </ShowMore>
      </div>
      <div className="space-y-8 lg:sticky lg:top-20 lg:self-start">
        <FollowUpsSection ids={ids} d={data} />
        <SendCard ids={ids} d={data} />
      </div>
    </div>
  )
}
