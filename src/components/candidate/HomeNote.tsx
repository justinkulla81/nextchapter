'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { Signature } from '@/components/ui/signature'
import { cn } from '@/lib/utils'

// Today's note: the one thing to do now, why it matters, and how to start. There is only ever one of
// these on Home. "Why am I seeing this?" holds the explanation. "Not now" hides it until tomorrow.
export function HomeNote({ kind = 'note', title, why, startLabel, startHref, whyDetail, variant = 'card', aside }: {
  kind?: string; title: string; why: string; startLabel: string; startHref: string; whyDetail: string
  /** 'paper': warm paper card, a handwritten aside and Victoria's signature in place of the "Cue" pill. Off by default. */
  variant?: 'card' | 'paper'
  /** The handwritten aside as a signed image URL plus its text (the alt). Only the paper variant draws it. */
  aside?: { src: string | null; text: string } | null
}) {
  const paper = variant === 'paper'
  const dayKey = `nc-note-dismissed:${kind}`
  const today = new Date().toISOString().slice(0, 10)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (window.localStorage.getItem(dayKey) === today) setHidden(true)
      } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [dayKey, today])

  if (hidden) return null
  return (
    <section aria-labelledby="note" className={cn('space-y-4 rounded-2xl border p-5 sm:p-7', paper ? 'border-paper-edge bg-paper' : 'border-border bg-white')}>
      <div className="flex items-center gap-2">
        {!paper && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Cue</span>}
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Today&apos;s note</span>
      </div>
      {paper && aside?.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={aside.src} alt={aside.text} height={30} className="h-[30px] w-auto" />
      )}
      <h2 id="note" className="font-display text-2xl leading-tight font-semibold tracking-tight text-ink text-balance sm:text-3xl">
        {title}
      </h2>
      <p className="max-w-2xl text-base text-ink">
        <span className="font-semibold">Why it matters:</span> {why}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={startHref}
          onClick={() => posthog.capture('home_note_started', { kind, variant })}
          className="inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          {startLabel}
        </Link>
        <button
          type="button"
          onClick={() => {
            posthog.capture('home_note_dismissed', { kind, variant })
            try {
              window.localStorage.setItem(dayKey, today)
            } catch {}
            setHidden(true)
          }}
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          Not now
        </button>
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-brand underline underline-offset-4 [&::-webkit-details-marker]:hidden">Why am I seeing this?</summary>
          <p className="mt-2 max-w-md rounded-lg bg-muted/60 p-3 text-sm text-ink">{whyDetail}</p>
        </details>
      </div>
      {paper && <Signature />}
    </section>
  )
}
