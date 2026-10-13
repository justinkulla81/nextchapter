'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { applyForCollege } from '@/app/i/[slug]/recruit/actions'

const STATUS: Record<string, string> = {
  PENDING: 'Requested. Career Services will review it; you’ll get access to the Employer workspace once approved.',
  APPROVED: 'You’re approved. Open the Employer workspace from the college’s portal.',
  REJECTED: 'This college isn’t taking new employers right now.',
}

export function RecruitButton({ slug, college, initial }: { slug: string; college: string; initial: string | null }) {
  const [pending, start] = useTransition()
  const [status, setStatus] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  if (status) return <p role="status">{STATUS[status] ?? status}</p>
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await applyForCollege(slug)
            if (r.error) setError(r.error)
            else setStatus(r.status ?? 'PENDING')
          })
        }
      >
        {pending ? 'Sending…' : `Ask to recruit ${college} alumni`}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
