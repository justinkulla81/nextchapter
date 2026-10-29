'use client'

import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

// The résumé step's secondary action, open to everyone. A plain text button inside a form
// that runs the skipResume action, so it works before the page has hydrated and shows the busy cursor while it runs.
export function SkipResumeButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn('text-sm font-medium text-brand underline underline-offset-4', pending ? 'cursor-progress' : 'cursor-pointer')}
    >
      {pending ? 'One moment…' : 'Skip the résumé and enter my details'}
    </button>
  )
}
