'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { acceptInvite } from '@/app/i/[slug]/member/[token]/actions'

export function AcceptMemberInvite({ slug, token, email }: { slug: string; token: string; email: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <p className="text-sm text-muted-foreground">You&apos;re signed in as {email}.</p>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await acceptInvite(slug, token)
            if (r?.error) setError(r.error)
          })
        }
      >
        {pending ? 'Connecting…' : 'Accept and open your company portal'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
