'use client'

import { Button } from '@/components/ui/button'
import { markAskedForHelp } from '@/app/dashboard/actions'

export function HelpScriptCard({ helpScript, done }: { helpScript: string; done: boolean }) {
  if (done) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Ask someone for help</h2>
        <p className="text-sm text-success">✓ Done — you&apos;ve reached out.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Ask someone for help</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick one person from your list below and send this. You don&apos;t need to write it yourself.
        </p>
      </div>
      <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{helpScript}</pre>
      <form action={markAskedForHelp}>
        <Button type="submit" size="sm" variant="outline">
          Mark as done — I asked someone
        </Button>
      </form>
    </div>
  )
}
