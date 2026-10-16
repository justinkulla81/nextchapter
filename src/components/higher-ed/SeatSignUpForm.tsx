'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { claimSeat } from '@/app/i/[slug]/rapid/[id]/actions'

// A layoff seat from a workforce org: name and email, then join with that
// email. Inputs stay filled if anything fails.
export function SeatSignUpForm({ slug, id, orgName }: { slug: string; id: string; orgName: string }) {
  const [v, setV] = useState({ firstName: '', lastName: '', email: '' })
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  if (done)
    return (
      <div role="status" className="space-y-3">
        <p className="text-lg">Your seat is saved. Next, create your free NextChapter account with {v.email}.</p>
        <Link href={`/i/${slug}/join`} className={buttonVariants({ size: 'lg' })}>
          Create my account
        </Link>
        <p className="text-sm text-muted-foreground">{orgName} sees that you joined, and only what you choose to share about your search.</p>
      </div>
    )
  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ss-first">First name</Label>
          <Input id="ss-first" value={v.firstName} onChange={set('firstName')} autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ss-last">Last name</Label>
          <Input id="ss-last" value={v.lastName} onChange={set('lastName')} autoComplete="family-name" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ss-email">Email (a personal one, not your work email)</Label>
          <Input id="ss-email" type="email" value={v.email} onChange={set('email')} autoComplete="email" />
        </div>
      </div>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await claimSeat(slug, id, v)
            if (r.error) setError(r.error)
            else setDone(true)
          })
        }
      >
        {pending ? 'Saving…' : 'Claim my seat'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
