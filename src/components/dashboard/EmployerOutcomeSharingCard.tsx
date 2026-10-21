'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setEmployerOutcomeSharing } from '@/app/dashboard/got-hired/sharing-actions'

export interface SharingSeat {
  seatId: string
  orgName: string
  share: boolean
}

// Shown only to people whose employer bought them a program. Off by default.
// The employer only ever sees anonymous group counts, never a name, pay or any
// detail, and people in Confidential Search Mode are never included.
export function EmployerOutcomeSharingCard({ seats }: { seats: SharingSeat[] }) {
  if (seats.length === 0) return null
  return (
    <section aria-labelledby="share-h" className="space-y-3">
      <div className="space-y-1">
        <h2 id="share-h" className="font-display text-xl font-semibold text-ink">
          Share anonymous results with your employer’s program
        </h2>
        <p className="max-w-2xl text-base text-muted-foreground">
          Your employer paid for your program. If you choose, whether you found work is counted in a group total with at least nine others. They never see your name, pay or activity. It is off unless you turn it on, and never applies in Confidential Search Mode.
        </p>
      </div>
      <ul className="space-y-3">
        {seats.map((s) => (
          <SeatRow key={s.seatId} seat={s} />
        ))}
      </ul>
    </section>
  )
}

function SeatRow({ seat }: { seat: SharingSeat }) {
  const [share, setShare] = useState(seat.share)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const choose = (next: boolean) => {
    if (next === share) return
    setError(null)
    start(async () => {
      const r = await setEmployerOutcomeSharing(seat.seatId, next)
      if (r.error) setError(r.error)
      else setShare(next)
    })
  }

  return (
    <li className={cn('space-y-2', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="text-base font-semibold text-ink">{seat.orgName}</p>
      <div className="flex gap-2" role="group" aria-label={`Share anonymous results with ${seat.orgName}`}>
        <Button type="button" size="sm" variant="outline" className={cn(share && 'border-ink font-semibold text-ink')} aria-pressed={share} disabled={pending} onClick={() => choose(true)}>
          Share anonymously
        </Button>
        <Button type="button" size="sm" variant="outline" className={cn(!share && 'border-ink font-semibold text-ink')} aria-pressed={!share} disabled={pending} onClick={() => choose(false)}>
          Do not share
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  )
}
