'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { joinMentors } from '@/app/i/[slug]/mentor/actions'

export function MentorJoin({ slug, token, industries }: { slug: string; token: string; industries: readonly string[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [max, setMax] = useState(2)
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (done) return <p role="status" className="text-lg">You&apos;re in. We&apos;ll email you when an alum asks for a call; you accept or decline each one.</p>
  return (
    <div className={cn('space-y-5', pending && 'cursor-wait')}>
      <fieldset className="space-y-2">
        <legend className="font-medium">Industries you can speak to</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {industries.map((i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={picked.has(i)}
                onChange={(e) => {
                  const n = new Set(picked)
                  if (e.target.checked) n.add(i)
                  else n.delete(i)
                  setPicked(n)
                }}
              />
              {i}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-medium">Calls a month, at most</legend>
        <div className="flex gap-2">
          {[1, 2, 4].map((n) => (
            <Button key={n} type="button" size="sm" variant={max === n ? 'default' : 'outline'} aria-pressed={max === n} onClick={() => setMax(n)}>
              {n}
            </Button>
          ))}
        </div>
      </fieldset>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await joinMentors(slug, token, [...picked], max)
            if (r.error) setError(r.error)
            else setDone(true)
          })
        }
      >
        {pending ? 'Saving…' : 'Count me in'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
