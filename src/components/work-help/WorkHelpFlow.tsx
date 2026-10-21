'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/candidate/ui'
import { PageHeader } from '@/components/candidate/PageHeader'
import {
  MAX_BODY_CHARS,
  MAX_REPLY_CHARS,
  MAX_SITUATION_CHARS,
  MAX_TITLE_CHARS,
  WORK_KINDS,
  type ActionResult,
  type PreparedQuestion,
  type WorkAnalysis,
  type WorkKind,
  type WorkOption,
  type WorkQuestionView,
} from '@/lib/work-help/constants'

export interface PostedResult {
  status: 'PUBLISHED' | 'HELD'
  handle: string
  notice?: string
  showSupportLink?: boolean
}

// The server actions, passed in so the same screens run on the real page and on the dev preview with sample answers.
export interface WorkHelpActions {
  analyze(input: { kind: string; text: string }): Promise<ActionResult<{ analysis: WorkAnalysis }>>
  prepare(input: { kind: string; text: string }): Promise<ActionResult<{ question: PreparedQuestion }>>
  post(input: { kind: string; title: string; body: string }): Promise<ActionResult<PostedResult>>
  remove(questionId: string): Promise<ActionResult>
  reply(input: { questionId: string; body: string }): Promise<ActionResult<{ held: boolean }>>
  report(input: { type: 'question' | 'reply'; id: string }): Promise<ActionResult>
}

type Part = 'start' | 'options' | 'ask' | 'help'
const PARTS: { key: Part; label: string }[] = [
  { key: 'start', label: 'Describe it' },
  { key: 'options', label: 'Your options' },
  { key: 'ask', label: 'Ask others' },
  { key: 'help', label: 'Help others' },
]

const primaryBtn = 'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 aria-disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const secondaryBtn = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted aria-disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const linkBtn = 'text-sm font-medium text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const fieldCls = 'w-full rounded-xl border border-border bg-white p-3.5 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function PrivateLine() {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      Only you see this. It is never shown to your employer, recruiters or the community.
    </p>
  )
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {text}
    </p>
  )
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border p-7">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="max-w-xl text-base text-muted-foreground">{body}</p>
      {action}
    </section>
  )
}

export function WorkHelpFlow({
  actions,
  initialMine,
  initialOthers,
  onChanged,
  capture,
}: {
  actions: WorkHelpActions
  initialMine: WorkQuestionView[]
  initialOthers: WorkQuestionView[]
  /** Called after anything that changes the lists, so the page can reload them. */
  onChanged?: () => void
  /** Client analytics. Never given any of the member's text. */
  capture?: (event: string, props: Record<string, unknown>) => void
}) {
  const [part, setPart] = useState<Part>('start')
  const [pending, startTransition] = useTransition()

  // What the member typed lives only here, in this tab. It is never saved.
  const [kind, setKind] = useState<WorkKind | null>(null)
  const [text, setText] = useState('')
  const [startError, setStartError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<WorkAnalysis | null>(null)

  const [prepared, setPrepared] = useState<PreparedQuestion | null>(null)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [postError, setPostError] = useState<string | null>(null)
  const [posted, setPosted] = useState<PostedResult | null>(null)

  const hasSituation = kind !== null && text.trim().length > 0
  const busyClass = pending || preparing ? 'cursor-wait [&_*]:cursor-wait' : ''

  function prepare(force = false) {
    if (!kind || (prepared && !force)) return
    setPreparing(true)
    setPrepareError(null)
    void actions
      .prepare({ kind, text })
      .then((r) => {
        if (r.ok) {
          setPrepared(r.question)
          setTitle(r.question.title)
          setBody(r.question.body)
          setEditing(false)
          capture?.('work_issue_question_reviewed', { kind, removedKinds: r.question.removed.length })
        } else setPrepareError(r.error)
      })
      .catch(() => setPrepareError('Something went wrong. Your description is still here. Try again.'))
      .finally(() => setPreparing(false))
  }

  function select(next: Part) {
    setPart(next)
    if (next === 'ask' && hasSituation && !prepared && !preparing && !posted) prepare()
  }

  function describe() {
    if (pending) return
    setStartError(null)
    if (!kind) return setStartError('Choose who it is about first.')
    if (text.trim().length < 20) return setStartError('Say a little more about what is happening, at least a sentence or two.')
    startTransition(async () => {
      try {
        const r = await actions.analyze({ kind, text })
        if (!r.ok) return setStartError(r.error)
        setAnalysis(r.analysis)
        setPrepared(null)
        setPosted(null)
        setPrepareError(null)
        setPart('options')
      } catch {
        setStartError('Something went wrong. What you typed is still here. Try again.')
      }
    })
  }

  function post() {
    if (!kind || pending) return
    setPostError(null)
    startTransition(async () => {
      try {
        const r = await actions.post({ kind, title: title.trim(), body: body.trim() })
        if (!r.ok) return setPostError(r.error)
        setPosted({ status: r.status, handle: r.handle, notice: r.notice, showSupportLink: r.showSupportLink })
        onChanged?.()
      } catch {
        setPostError('Something went wrong. Your wording is still here. Try again.')
      }
    })
  }

  return (
    <div className={cn('space-y-8', busyClass)} aria-busy={pending || preparing}>
      <nav aria-label="A hard situation at work" className="flex flex-wrap gap-2">
        {PARTS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => select(p.key)}
            aria-current={part === p.key ? 'page' : undefined}
            className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', part === p.key ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {part === 'start' && (
        <div className="space-y-8">
          <PageHeader title="A hard situation at work" intro="Say what is going on. We help you see your options, including staying. We do not push you to leave." />
          <section className="space-y-5 rounded-2xl border border-border p-7" aria-label="Describe the situation">
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold text-ink">Who is it about?</h2>
              <div role="group" aria-label="Who it is about" className="flex flex-wrap gap-3">
                {WORK_KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    aria-pressed={kind === k.key}
                    onClick={() => setKind(k.key)}
                    className={cn('h-11 rounded-full px-5 text-sm', kind === k.key ? 'bg-ink font-semibold text-white' : 'border border-border font-medium text-ink hover:bg-muted')}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="work-situation" className="text-base font-semibold text-ink">What is happening?</label>
              <textarea id="work-situation" rows={5} value={text} maxLength={MAX_SITUATION_CHARS} onChange={(e) => setText(e.target.value)} className={fieldCls} placeholder="For example: my manager presents my work as theirs in meetings with senior leaders." />
              <PrivateLine />
            </div>
            <Problem text={startError} />
            <button type="button" onClick={describe} aria-disabled={pending} className={primaryBtn}>
              {pending ? 'Thinking it through…' : 'Help me think it through'}
            </button>
          </section>
          <p className="max-w-xl text-sm text-muted-foreground">
            We cannot give legal advice. If this involves harassment or discrimination, we will point you to the right people. In crisis? Call or text 988 any time, free.
          </p>
        </div>
      )}

      {part === 'options' && (
        <div className="space-y-8">
          {!analysis ? (
            <>
              <PageHeader title="Your options" />
              <Empty
                title="Describe what is happening first"
                body="Your options come from what you tell us. It takes a minute, and only you see it."
                action={<button type="button" onClick={() => select('start')} className={primaryBtn}>Describe it</button>}
              />
            </>
          ) : (
            <Options analysis={analysis} kind={kind} capture={capture} onAsk={() => select('ask')} />
          )}
        </div>
      )}

      {part === 'ask' && (
        <div className="space-y-8">
          <PageHeader title="Ask others who have been there" intro="Check what people will see before anything is posted. Nothing is shared until you say so." />
          {!hasSituation ? (
            <Empty
              title="Describe what is happening first"
              body="We turn what you tell us into a short question with names and details taken out. Start there."
              action={<button type="button" onClick={() => select('start')} className={primaryBtn}>Describe it</button>}
            />
          ) : posted ? (
            <section className="space-y-3 rounded-2xl border border-border p-7" role="status">
              <h2 className="font-display text-xl font-semibold text-ink">{posted.status === 'HELD' ? 'Your question is in review' : 'Your question is live'}</h2>
              <p className="text-base text-ink">{posted.notice ?? <>Posted as <span className="font-semibold">{posted.handle}</span>. Replies appear under your questions below.</>}</p>
              {posted.showSupportLink && <Link href="/dashboard/support" className={linkBtn}>See support options</Link>}
            </section>
          ) : preparing || (!prepared && !prepareError) ? (
            <section className="space-y-2 rounded-2xl border border-border p-7" role="status">
              <h2 className="font-display text-xl font-semibold text-ink">Making your question anonymous…</h2>
              <p className="text-sm text-muted-foreground">We are taking out names and details that could identify you or anyone else.</p>
            </section>
          ) : prepareError ? (
            <section className="space-y-3 rounded-2xl border border-border p-7">
              <Problem text={prepareError} />
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => prepare(true)} className={primaryBtn}>Try again</button>
                <button type="button" onClick={() => select('start')} className={secondaryBtn}>Change my description</button>
              </div>
            </section>
          ) : prepared ? (
            <section className="space-y-5 rounded-2xl border border-border p-7" aria-label="Review before posting">
              <h2 className="font-display text-xl font-semibold text-ink">What others will see</h2>
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="wq-title" className="text-sm font-semibold text-ink">Your question</label>
                    <input id="wq-title" value={title} maxLength={MAX_TITLE_CHARS} onChange={(e) => setTitle(e.target.value)} className={cn(fieldCls, 'h-11 py-0')} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="wq-body" className="text-sm font-semibold text-ink">Context</label>
                    <textarea id="wq-body" rows={5} value={body} maxLength={MAX_BODY_CHARS} onChange={(e) => setBody(e.target.value)} className={fieldCls} />
                  </div>
                  <p className="text-sm text-muted-foreground">We check again for your name, company and city when you post.</p>
                </div>
              ) : (
                <blockquote className="max-w-2xl space-y-1.5 rounded-xl bg-muted p-5">
                  <p className="text-base font-semibold text-ink">{title}</p>
                  <p className="text-base whitespace-pre-line text-ink">{body}</p>
                </blockquote>
              )}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">We took out</p>
                {prepared.removed.length > 0 ? (
                  <div className="flex flex-wrap gap-2">{prepared.removed.map((r) => <Chip key={r} tone="warm">{r}</Chip>)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground">We found no names or places to take out. Read it once more before you post.</p>
                )}
              </div>
              <ul className="space-y-2 text-sm text-ink">
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />Posted under a generated name, never your own.</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />Seen only by people at your level who work at other companies, never anyone at your current employer.</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />You can delete it any time.</li>
              </ul>
              <Problem text={postError} />
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={post} aria-disabled={pending} className={primaryBtn}>{pending ? 'Posting…' : 'Post this question'}</button>
                <button type="button" onClick={() => setEditing((e) => !e)} className={secondaryBtn}>{editing ? 'Done editing' : 'Edit the wording'}</button>
                <button type="button" onClick={() => select('options')} className={linkBtn}>Keep it private instead</button>
              </div>
            </section>
          ) : null}
          {initialMine.length > 0 && <MyQuestions items={initialMine} actions={actions} onChanged={onChanged} />}
        </div>
      )}

      {part === 'help' && (
        <div className="space-y-8">
          <PageHeader title="Help someone at your level" intro="People ask these without names or companies. Share what worked for you, in general terms." />
          {initialOthers.length === 0 ? (
            <Empty title="No questions to answer right now" body="When someone at your level at another company asks one, it shows up here." />
          ) : (
            <ul className="space-y-4">
              {initialOthers.map((q) => (
                <li key={q.id}>
                  <OthersQuestion q={q} actions={actions} onChanged={onChanged} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Options({ analysis, kind, capture, onAsk }: { analysis: WorkAnalysis; kind: WorkKind | null; capture?: (e: string, p: Record<string, unknown>) => void; onAsk: () => void }) {
  const [first, ...rest] = analysis.options
  const chosen = (o: WorkOption) => capture?.('work_issue_option_chosen', { kind, optionKey: o.key, generic: analysis.generic })
  return (
    <>
      <PageHeader title="Your options" intro={analysis.acknowledgement} />
      {analysis.generic && <p className="text-sm text-muted-foreground">We could not tailor these just now, so these are the standard options. Try again in a moment for options that fit your situation.</p>}
      <section className="space-y-4 rounded-2xl border border-border p-7" aria-label="Where to start">
        <Chip tone="good">Start here</Chip>
        <h2 className="font-display text-2xl font-semibold text-ink">{first.title}</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> {first.why}</p>
        <p className="max-w-2xl text-base text-muted-foreground">{first.firstStep}</p>
        {first.href && first.actionLabel && <Link href={first.href} onClick={() => chosen(first)} className={primaryBtn}>{first.actionLabel}</Link>}
      </section>
      {rest.length > 0 && (
        <section className="space-y-3" aria-labelledby="wh-other">
          <h2 id="wh-other" className="font-display text-xl font-semibold text-ink">If that is not enough</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rest.map((o) => (
              <li key={o.key} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="max-w-xl min-w-0 space-y-1">
                  <p className="text-base font-semibold text-ink">{o.title}</p>
                  <p className="text-sm text-muted-foreground">Why: {o.why}</p>
                  <details className="text-sm text-ink">
                    <summary className="cursor-pointer font-medium">How to start</summary>
                    <p className="mt-1 text-muted-foreground">{o.firstStep}</p>
                  </details>
                </div>
                {o.href && o.actionLabel && <Link href={o.href} onClick={() => chosen(o)} className={secondaryBtn}>{o.actionLabel}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {analysis.needsLegalPointer && (
        <p className="max-w-2xl rounded-xl bg-muted p-4 text-sm text-ink">
          What you describe may involve something the law covers. We cannot give legal advice. HR, an employment lawyer or your local labor agency can tell you what applies. Keep dated notes of what happened.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Want to hear from people who have been through this?{' '}
        <button type="button" onClick={onAsk} className={linkBtn}>Ask others, without your name or company</button>
      </p>
    </>
  )
}

function MyQuestions({ items, actions, onChanged }: { items: WorkQuestionView[]; actions: WorkHelpActions; onChanged?: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  function remove(id: string) {
    setError(null)
    start(async () => {
      const r = await actions.remove(id).catch(() => ({ ok: false as const, error: 'Something went wrong. Try again.' }))
      if (!r.ok) return setError(r.error)
      setConfirming(null)
      onChanged?.()
    })
  }
  return (
    <section className="space-y-3" aria-labelledby="wh-mine">
      <h2 id="wh-mine" className="font-display text-xl font-semibold text-ink">Your questions</h2>
      <Problem text={error} />
      <ul className="space-y-4">
        {items.map((q) => (
          <li key={q.id} className="space-y-3 rounded-2xl border border-border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-ink">{q.title}</p>
              {q.status === 'HELD' && <Chip tone="warm">In review</Chip>}
            </div>
            <p className="text-sm text-muted-foreground">Posted {day(q.createdAt)} as {q.handle} · {q.replies.length === 1 ? '1 reply' : `${q.replies.length} replies`}</p>
            {q.replies.length > 0 && (
              <ul className="space-y-2">
                {q.replies.map((r) => (
                  <li key={r.id} className="rounded-xl bg-muted p-4 text-sm text-ink"><span className="font-semibold">{r.handle}</span> · {day(r.createdAt)}<p className="mt-1 whitespace-pre-line">{r.body}</p></li>
                ))}
              </ul>
            )}
            {confirming === q.id ? (
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Confirm delete">
                <p className="text-sm text-ink">Delete this question and its replies for good?</p>
                <button type="button" onClick={() => remove(q.id)} aria-disabled={pending} className={secondaryBtn}>{pending ? 'Deleting…' : 'Yes, delete it'}</button>
                <button type="button" onClick={() => setConfirming(null)} className={linkBtn} autoFocus>Keep it</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(q.id)} className={linkBtn}>Delete this question</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function OthersQuestion({ q, actions, onChanged }: { q: WorkQuestionView; actions: WorkHelpActions; onChanged?: () => void }) {
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const id = `reply-${q.id}`
  function send() {
    if (pending) return
    setError(null)
    setNote(null)
    start(async () => {
      const r = await actions.reply({ questionId: q.id, body: reply }).catch(() => ({ ok: false as const, error: 'Something went wrong. Your reply is still here. Try again.' }))
      if (!r.ok) return setError(r.error)
      setReply('')
      setNote(r.held ? 'Your reply is in review and will show once it is cleared.' : 'Your reply is sent.')
      onChanged?.()
    })
  }
  function report(type: 'question' | 'reply', targetId: string) {
    start(async () => {
      const r = await actions.report({ type, id: targetId }).catch(() => ({ ok: false as const, error: 'Something went wrong. Try again.' }))
      setNote(r.ok ? 'Thank you. Our team will take a look.' : r.error)
    })
  }
  return (
    <article className="space-y-3 rounded-2xl border border-border p-5">
      <p className="text-base font-semibold text-ink">{q.title}</p>
      <p className="text-base whitespace-pre-line text-ink">{q.body}</p>
      <p className="text-sm text-muted-foreground">{q.handle} · {day(q.createdAt)}</p>
      {q.replies.length > 0 && (
        <ul className="space-y-2">
          {q.replies.map((r) => (
            <li key={r.id} className="rounded-xl bg-muted p-4 text-sm text-ink">
              <span className="font-semibold">{r.mine ? 'You' : r.handle}</span> · {day(r.createdAt)}
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
              {!r.mine && <button type="button" onClick={() => report('reply', r.id)} className={cn(linkBtn, 'mt-1')}>Report this reply</button>}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">Your reply</label>
        <textarea id={id} rows={3} value={reply} maxLength={MAX_REPLY_CHARS} onChange={(e) => setReply(e.target.value)} className={fieldCls} placeholder="What worked for you? Keep names and companies out." />
      </div>
      <Problem text={error} />
      {note && <p role="status" className="text-sm text-success">{note}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={send} aria-disabled={pending} className={secondaryBtn}>{pending ? 'Sending…' : 'Send reply'}</button>
        <button type="button" onClick={() => report('question', q.id)} className={linkBtn}>Report this question</button>
      </div>
    </article>
  )
}
