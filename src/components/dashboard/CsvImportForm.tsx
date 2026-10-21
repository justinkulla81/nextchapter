'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { importConnectionsCsv } from '@/app/dashboard/network/actions'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importConnectionsCsv, undefined)
  const router = useRouter()

  // The server action already revalidates the contacts path, but the
  // contact table above this form was rendered before the import ran —
  // router.refresh() re-fetches it so the new/updated rows show up without
  // the candidate having to reload the page themselves.
  useEffect(() => {
    if (state?.imported !== undefined) router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form
      action={formAction}
      className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <p className={'text-sm text-muted-foreground'}>
        We can analyze your network to surface warm introductions and the right people to reach
        out to for your target roles. We only read the file you upload here — we never log into
        your LinkedIn account.{' '}
        <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
          Learn more
        </Link>
        .
      </p>
      <Input
        name="file"
        type="file"
        accept=".csv"
        required
        disabled={pending}
        className={cn(
          'h-auto py-2 file:mr-4 file:h-9 file:px-4',
          pending && 'file:cursor-progress',
          'text-base file:rounded-full file:bg-muted file:text-ink'
        )}
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.imported !== undefined && (
        <p role="status" className={'text-base text-ink'}>
          {state.imported > 0
            ? `Added ${state.imported} new connection${state.imported === 1 ? '' : 's'}`
            : 'No new connections in that file'}
          {!!state.updated && ` — filled in missing details on ${state.updated} existing contact${state.updated === 1 ? '' : 's'}`}
          {!!state.skippedRemoved && ` (${state.skippedRemoved} left off — you removed them before)`}
          .
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:cursor-progress disabled:opacity-70"
          >
            {pending ? 'Importing…' : 'Import LinkedIn connections'}
          </button>
          <span className="text-sm text-muted-foreground">New contacts count toward Candidate+ (1 point is 1 minute).</span>
        </>
      </div>
    </form>
  )
}
