'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { rateCoachSession } from '@/app/dashboard/actions'
import { cn } from '@/lib/utils'

// §A5.4 post-session rating — plain 1-5 stars, same simple scale
// Reference.overallRating already uses elsewhere in this codebase. One shot:
// once submitted, the rating can't be changed from here (matches the
// one-time-shown nature of SessionImpactCard itself).
export function SessionRatingWidget({ sessionId }: { sessionId: string }) {
  const [rating, setRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(value: number) {
    setRating(value)
    startTransition(async () => {
      await rateCoachSession(sessionId, value)
      setSubmitted(true)
    })
  }

  if (submitted) {
    return <p className="text-xs text-muted-foreground">Thanks for the feedback.</p>
  }

  return (
    <div className={cn('flex items-center gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <span className="text-xs text-muted-foreground">How was this session?</span>
      <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rate this session, 1 to 5 stars">
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = (hovered ?? rating ?? 0) >= value
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => submit(value)}
              className="p-0.5"
            >
              <Star className={cn('size-4', filled ? 'fill-orange text-orange' : 'text-muted-foreground')} aria-hidden />
            </button>
          )
        })}
      </div>
    </div>
  )
}
