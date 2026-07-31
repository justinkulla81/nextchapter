'use client'

import { useTransition } from 'react'
import { setCandidateTester } from '@/app/support/admin/(portal)/tracking-testers/actions'
import { cn } from '@/lib/utils'

export function TesterCheckbox({ candidateId, enabled }: { candidateId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <input
      type="checkbox"
      defaultChecked={enabled}
      disabled={isPending}
      aria-label="Gmail/Calendar tracking tester"
      className={cn('size-4 accent-brand', isPending && 'cursor-wait')}
      onChange={(e) => {
        const next = e.target.checked
        startTransition(async () => {
          await setCandidateTester(candidateId, next)
        })
      }}
    />
  )
}
