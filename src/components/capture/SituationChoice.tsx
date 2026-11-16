'use client'

import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PLACE_SITUATIONS, placeStartHref } from '@/lib/onboarding/arrived-from'
import { cn } from '@/lib/utils'

export interface SituationAsk {
  /** Two-letter state code. */
  state: string
  /** The place as the page names it ("Franklin County"). */
  area: string
  /** The workforce board that serves the place, when there is exactly one (boardForPlace). */
  boardId?: string | null
  /** The page's slug, for attribution (`from=top_<slug>`). */
  slug: string
  /** 'place' or 'board': which kind of page the choice was made on. */
  page: 'place' | 'board'
}

/**
 * The registration ask on a place or workforce-board page, as four adjacent choices instead of one button: the visitor says where
 * they are, and onboarding opens on that answer with the place (and its board) carried along (src/lib/onboarding/arrived-from.ts).
 * "Something else" keeps the plain path for every other situation. `tone` follows the band it sits in.
 */
export function SituationChoice({ ask, tone = 'dark' }: { ask: SituationAsk; tone?: 'dark' | 'light' }) {
  const props = { page: ask.page, state: ask.state, area: ask.area, boardId: ask.boardId ?? null, slug: ask.slug }
  const from = `top_${ask.slug}`.slice(0, 80)
  return (
    <div className="mt-4">
      <p id={`situation-${ask.slug}`} className="text-sm font-medium">Which one is you?</p>
      <div role="group" aria-labelledby={`situation-${ask.slug}`} className="mt-2 flex flex-wrap gap-2">
        {PLACE_SITUATIONS.map((s) => (
          <TrackedLink
            key={s.situation}
            href={placeStartHref({ situation: s.situation, state: ask.state, area: ask.area, boardId: ask.boardId, from })}
            event="place_situation_chosen"
            properties={{ ...props, situation: s.situation }}
            gtagEvent="pull_cta_clicked"
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-center text-sm font-semibold leading-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              tone === 'dark' ? 'bg-white text-navy hover:bg-white/90 focus-visible:ring-white' : 'border border-navy bg-white text-navy hover:bg-muted',
            )}
          >
            {s.label}
          </TrackedLink>
        ))}
      </div>
      <TrackedLink
        href={placeStartHref({ state: ask.state, area: ask.area, boardId: ask.boardId, from })}
        event="place_situation_chosen"
        properties={{ ...props, situation: 'other' }}
        className="mt-2 inline-flex min-h-10 items-center text-sm underline underline-offset-4 opacity-90 hover:opacity-100"
      >
        Something else
      </TrackedLink>
    </div>
  )
}
