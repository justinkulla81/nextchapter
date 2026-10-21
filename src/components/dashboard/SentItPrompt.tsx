'use client'

import { useEffect, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { confirmOutreachSent, snoozeOutreachPrompt } from '@/app/dashboard/log-prompt-actions'
import type { OutreachSource } from '@/lib/activity-log/outreach-note'

/** What a copied note was for — the server reads the company and contact kind from it. */
export interface SentItContext {
  source: OutreachSource
  /** One per job / contact / template: 'job:<id>', 'contact:<id>', 'template:<type>'. */
  subjectKey: string
  jobId?: string | null
  contactId?: string | null
  templateType?: string | null
}

interface Pending {
  context: SentItContext
  note: string
  reasked: boolean
}

const storageKey = (subjectKey: string) => `nc:sent-it:${subjectKey}`

function readPending(subjectKey: string): Pending | null {
  try {
    const raw = window.localStorage.getItem(storageKey(subjectKey))
    return raw ? (JSON.parse(raw) as Pending) : null
  } catch {
    return null
  }
}
function writePending(subjectKey: string, p: Pending | null) {
  try {
    if (p) window.localStorage.setItem(storageKey(subjectKey), JSON.stringify(p))
    else window.localStorage.removeItem(storageKey(subjectKey))
  } catch {
    // Private window or blocked storage: the re-ask just doesn't happen.
  }
}

const buttonClass = 'rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted'

/**
 * "Did you send it?" — shown right after a note is copied (`copySignal` changes), with
 * "✓ I sent it" and "Not yet". I sent it logs one outreach message toward Candidate+ (the
 * same note counts once per 24h); Not yet re-asks once on the next visit, wherever a
 * prompt with `reaskOnMount` for the same subject is rendered.
 */
export function SentItPrompt({
  context,
  note,
  copySignal = 0,
  reaskOnMount = false,
  redesign = false,
}: {
  /** The redesigned look: body-size text and the same rounded buttons as the rest of the page. */
  redesign?: boolean
  context: SentItContext
  /** The copied text. Omit for a re-ask-only prompt (it uses the stored note). */
  note?: string
  copySignal?: number
  reaskOnMount?: boolean
}) {
  const [mode, setMode] = useState<'hidden' | 'ask' | 'reask'>('hidden')
  const [askedNote, setAskedNote] = useState<string>('')
  const [askedContext, setAskedContext] = useState<SentItContext>(context)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // A fresh copy: ask now (adjusting state when the copy signal changes, during render).
  const [seenSignal, setSeenSignal] = useState(copySignal)
  if (copySignal !== seenSignal) {
    setSeenSignal(copySignal)
    if (copySignal && note) {
      setAskedNote(note)
      setAskedContext(context)
      setResult(null)
      setError(null)
      setMode('ask')
    }
  }

  // Next visit after "Not yet": ask once more, then never again for that copy. Read after
  // mount (storage is browser-only), in a callback so it runs once even in Strict Mode.
  useEffect(() => {
    if (!reaskOnMount) return
    const timer = window.setTimeout(() => {
      const p = readPending(context.subjectKey)
      if (!p || p.reasked) return
      writePending(context.subjectKey, { ...p, reasked: true })
      setAskedNote(p.note)
      setAskedContext(p.context)
      setMode('reask')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [reaskOnMount, context.subjectKey])

  function sent() {
    setError(null)
    start(async () => {
      try {
        const r = await confirmOutreachSent({
          source: askedContext.source,
          note: askedNote,
          jobId: askedContext.jobId ?? null,
          contactId: askedContext.contactId ?? null,
          templateType: askedContext.templateType ?? null,
        })
        if (!r.ok) return setError(r.error)
        writePending(askedContext.subjectKey, null)
        setResult(r.logged ? `Logged. ${r.progress}` : `Already counted in the last 24 hours. ${r.progress}`)
        setMode('hidden')
      } catch {
        setError('We couldn’t log that. Check your connection and try again.')
      }
    })
  }

  function notYet() {
    // A re-ask's "Not yet" is the last time we ask about that copy.
    writePending(askedContext.subjectKey, mode === 'reask' ? null : { context: askedContext, note: askedNote, reasked: false })
    void snoozeOutreachPrompt({ source: askedContext.source, jobId: askedContext.jobId ?? null, reask: mode === 'reask' }).catch(() => {})
    setMode('hidden')
  }

  if (mode === 'hidden') {
    return result ? (
      <p role="status" className={redesign ? 'text-sm text-ink' : 'text-xs text-success'}>
        {result}
      </p>
    ) : null
  }

  const choice = redesign ? 'inline-flex h-10 items-center rounded-full border border-border bg-white px-5 text-sm font-medium text-ink hover:bg-muted' : buttonClass
  return (
    <div
      role="group"
      aria-label="Did you send it?"
      aria-live="polite"
      className={cn(redesign ? 'flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 p-5' : 'flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2', pending && 'cursor-wait')}
    >
      <p className={redesign ? 'text-base text-ink' : 'text-sm text-foreground'}>{mode === 'reask' ? 'Did you send the note you copied last time?' : 'Did you send it?'}</p>
      <div className={redesign ? 'flex gap-2' : 'flex gap-1'}>
        <button type="button" onClick={sent} disabled={pending} aria-busy={pending} className={cn(choice, pending && 'cursor-wait')}>
          {pending ? 'Logging…' : redesign ? 'Yes, I sent it' : '✓ I sent it'}
        </button>
        <button type="button" onClick={notYet} disabled={pending} className={cn(choice, pending && 'cursor-wait')}>
          Not yet
        </button>
      </div>
      {error && (
        <p role="alert" className={cn('w-full text-destructive', redesign ? 'text-sm' : 'text-xs')}>
          {error}
        </p>
      )}
    </div>
  )
}
