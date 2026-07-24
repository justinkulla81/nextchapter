'use client'

import { useFormStatus } from 'react-dom'
import { signOut } from '@/app/dashboard/actions'
import { cn } from '@/lib/utils'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground',
        pending && 'cursor-progress'
      )}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitButton />
    </form>
  )
}
