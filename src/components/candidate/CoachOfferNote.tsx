'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { answerCoachOffer } from '@/app/dashboard/coach-offer-actions'

// The coach offer, as Home's one note (home-note.ts). Same shape as HomeNote: what to do, why it matters, how
// to start. Unlike HomeNote, "Not now" quiets it for 30 days on the server, and so does opening the coach page.
export function CoachOfferNote({ reason, title, why, whyDetail, href }: { reason: string; title: string; why: string; whyDetail: string; href: string }) {
  const [hidden, setHidden] = useState(false)
  const [pending, startTransition] = useTransition()
  if (hidden) return null
  return (
    <section aria-labelledby="note" className="space-y-4 rounded-2xl border border-border bg-white p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Cue</span>
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Today&apos;s note</span>
      </div>
      <h2 id="note" className="font-display text-2xl leading-tight font-semibold tracking-tight text-ink text-balance sm:text-3xl">
        {title}
      </h2>
      <p className="max-w-2xl text-base text-ink">
        <span className="font-semibold">Why it matters:</span> {why}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={href}
          onClick={() => {
            posthog.capture('coach_offer_clicked', { reason })
            // Fire and forget: the page is navigating, and the offer should be quiet when they come back.
            void answerCoachOffer(reason, 'opened')
          }}
          className="inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95"
        >
          Find my coach
        </Link>
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              posthog.capture('coach_offer_dismissed', { reason })
              const r = await answerCoachOffer(reason, 'snoozed')
              if (!r.error) setHidden(true)
            })
          }
          className="text-sm font-medium text-brand underline underline-offset-4 disabled:cursor-wait"
        >
          Not now
        </button>
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-brand underline underline-offset-4 [&::-webkit-details-marker]:hidden">Why am I seeing this?</summary>
          <p className="mt-2 max-w-md rounded-lg bg-muted/60 p-3 text-sm text-ink">{whyDetail} Not now hides it for 30 days.</p>
        </details>
      </div>
    </section>
  )
}
