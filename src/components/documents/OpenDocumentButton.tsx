'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Opens a file in a new tab through a short-lived link. The link is made on click,
// not on page load, so it never expires while the page sits open.
export function OpenDocumentButton({
  requestId,
  fileName,
  getUrl,
  label = 'Open file',
}: {
  requestId: string
  fileName: string
  getUrl: (requestId: string) => Promise<string | null>
  label?: string
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(pending && 'cursor-wait')}
        aria-label={`${label}: ${fileName}`}
        onClick={() =>
          start(async () => {
            setError(null)
            const url = await getUrl(requestId)
            if (url) window.open(url, '_blank', 'noopener,noreferrer')
            else setError('We could not open the file. Reload the page and try again.')
          })
        }
      >
        {pending ? 'Opening…' : label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
