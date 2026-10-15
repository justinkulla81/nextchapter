'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { signUpRapid } from '@/app/i/[slug]/rapid/[id]/actions'

// Pick a program, leave a name and email. Inputs stay filled if anything fails.
export function RapidSignUpForm({ slug, id, cohorts }: { slug: string; id: string; cohorts: { id: string; label: string }[] }) {
  const [v, setV] = useState({ cohortId: cohorts[0]?.id ?? '', firstName: '', lastName: '', email: '', note: '' })
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  if (done) return <p role="status" className="text-lg">Thank you. Someone from the program team will reach out within two business days about funding and next steps.</p>
  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')}>
      <fieldset className="space-y-2">
        <legend className="font-medium">Which program?</legend>
        {cohorts.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name="cohort" checked={v.cohortId === c.id} onChange={() => setV({ ...v, cohortId: c.id })} />
            {c.label}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rs-first">First name</Label>
          <Input id="rs-first" value={v.firstName} onChange={set('firstName')} autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rs-last">Last name</Label>
          <Input id="rs-last" value={v.lastName} onChange={set('lastName')} autoComplete="family-name" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rs-email">Email</Label>
          <Input id="rs-email" type="email" value={v.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rs-note">Anything we should know (optional)</Label>
          <textarea id="rs-note" className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm" value={v.note} maxLength={500} onChange={set('note')} />
        </div>
      </div>
      <Button
        size="lg"
        disabled={pending || !v.cohortId}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await signUpRapid(slug, id, v)
            if (r.error) setError(r.error)
            else setDone(true)
          })
        }
      >
        {pending ? 'Sending…' : 'Sign me up'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">We use your email only to follow up about this program.</p>
    </div>
  )
}
