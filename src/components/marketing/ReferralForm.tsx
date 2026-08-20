'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { submitReferral } from '@/app/refer/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function ReferralForm() {
  const [state, formAction, pending] = useActionState(submitReferral, undefined)

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-light-gray bg-off-white p-6 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="font-semibold text-navy">Sent!</p>
        <p className="text-sm text-muted-foreground">Your friend should see it in their inbox shortly.</p>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-xl border border-light-gray bg-off-white p-6 text-left',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-1">
        <Label htmlFor="friendEmail">Friend&apos;s email</Label>
        <Input id="friendEmail" name="friendEmail" type="email" required placeholder="friend@example.com" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="yourEmail">Your email</Label>
        <Input id="yourEmail" name="yourEmail" type="email" required placeholder="you@example.com" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className={cn('w-full', pending && 'cursor-progress')} variant="cta">
        {pending ? 'Sending…' : 'Send it'}
      </Button>
    </form>
  )
}
