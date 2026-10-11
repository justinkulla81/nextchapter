'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { joinWithToken } from '@/app/i/[slug]/join/actions'

export function JoinButton({ slug, token, label }: { slug: string; token: string; label: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        disabled={pending}
        className={cn(pending && 'cursor-wait')}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await joinWithToken(slug, token)
            if (r?.error) setError(r.error)
          })
        }
      >
        {pending ? 'Signing you in…' : label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
