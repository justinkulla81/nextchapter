'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { requestPasswordReset } from '@/app/auth/forgot-password/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined)
  const [email, setEmail] = useState(searchParams.get('email') ?? '')

  if (state?.sent) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
          link to reset your password.
        </p>
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account yet?{' '}
          <Link
            href="/onboarding/resume"
            className="font-medium text-primary underline underline-offset-4"
          >
            Create one
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}
