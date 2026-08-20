'use client'

import { useState, useTransition } from 'react'
import { logCrucibleInterestStandalone } from '@/app/crucible/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function CrucibleInterestForm({ kind }: { kind: 'FULL' | 'LESSON' }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (sent) {
    return <p className="font-medium text-success">You&apos;re on the list — we&apos;ll let you know.</p>
  }

  return (
    <form
      className={cn('mx-auto flex max-w-sm gap-2', isPending && 'cursor-wait [&_*]:cursor-wait')}
      onSubmit={(e) => {
        e.preventDefault()
        if (!email.trim()) return
        startTransition(async () => {
          await logCrucibleInterestStandalone(kind, email.trim(), 'LANDING')
          setSent(true)
        })
      }}
    >
      <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Button type="submit" disabled={isPending}>
        Notify me
      </Button>
    </form>
  )
}
