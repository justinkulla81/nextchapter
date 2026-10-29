'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { saveContactDetails } from '@/app/onboarding/details-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

// A name and an email for everyone, LinkedIn if they have it. Answers stay on screen after an error: React resets an
// uncontrolled form once its action returns, so every field is controlled here.
export function DetailsForm({ defaults }: { defaults: { firstName: string; lastName: string; email: string; linkedInUrl: string } }) {
  const [state, formAction, pending] = useActionState(saveContactDetails, undefined)
  const [values, setValues] = useState(defaults)
  const bind = (key: keyof typeof defaults) => ({ value: values[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value })) })
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required autoComplete="given-name" {...bind('firstName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required autoComplete="family-name" {...bind('lastName')} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" {...bind('email')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="linkedInUrl">LinkedIn profile (optional)</Label>
        <Input id="linkedInUrl" name="linkedInUrl" inputMode="url" autoComplete="url" placeholder="linkedin.com/in/your-name" {...bind('linkedInUrl')} />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}{' '}
          {state.existingAccount && (
            <Link href="/auth/login" className="font-medium underline underline-offset-4">
              Log in
            </Link>
          )}
        </p>
      )}
      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : undefined}>
        {pending ? 'One moment…' : 'Continue'}
      </Button>
    </form>
  )
}
