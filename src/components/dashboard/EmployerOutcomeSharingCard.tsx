'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Share anonymous results with your employer&apos;s program</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your employer paid for your program and may want to know whether it works. If you choose, whether you found work is counted in a
            group total together with at least nine others. Your employer never sees your name, pay, activity or anything about you. This is
            off unless you turn it on, and you can turn it off at any time. It never applies while you use Confidential Search Mode.
          </p>
        </div>
        <ul className="space-y-3">
          {seats.map((s) => (
            <SeatRow key={s.seatId} seat={s} />
          ))}
        </ul>
      </CardContent>
    </Card>
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
      <p className="text-sm font-medium text-foreground">{seat.orgName}</p>
      <div className="flex gap-2" role="group" aria-label={`Share anonymous results with ${seat.orgName}`}>
        <Button type="button" size="sm" variant={share ? 'default' : 'outline'} aria-pressed={share} disabled={pending} onClick={() => choose(true)}>
          Share anonymously
        </Button>
        <Button type="button" size="sm" variant={!share ? 'default' : 'outline'} aria-pressed={!share} disabled={pending} onClick={() => choose(false)}>
          Do not share
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  )
}
