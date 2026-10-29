'use client'

import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

// The résumé step's minor action, open to everyone (the upload is the main one). A small text button inside a form
// that runs the skipResume action, so it works before the page has hydrated and shows the busy cursor while it runs.
export function SkipResumeButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn('text-xs text-muted-foreground underline underline-offset-4 hover:text-ink', pending ? 'cursor-progress' : 'cursor-pointer')}
    >
      {pending ? 'One moment…' : 'Enter my details instead'}
    </button>
  )
}
