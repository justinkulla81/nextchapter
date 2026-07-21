'use client'

import { useState, useTransition } from 'react'
import { submitCoachConsent } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CoachConsentChoice({ coachName }: { coachName: string }) {
  const [pending, startTransition] = useTransition()
  const [choosing, setChoosing] = useState<'agree' | 'not_now' | null>(null)

  function choose(intent: 'agree' | 'not_now') {
    setChoosing(intent)
    startTransition(() => {
      submitCoachConsent(intent)
    })
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => choose('agree')} disabled={pending}>
          {pending && choosing === 'agree' ? 'Saving…' : `Yes, share with ${coachName}`}
        </Button>
        <Button variant="outline" onClick={() => choose('not_now')} disabled={pending}>
          {pending && choosing === 'not_now' ? 'Saving…' : 'Not right now'}
        </Button>
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        You can turn this on later from Profile &amp; Privacy if you choose &quot;Not right now.&quot;
      </p>
    </div>
  )
}
