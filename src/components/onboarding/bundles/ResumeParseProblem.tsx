'use client'

import { useTransition } from 'react'
import { retryResumeParse, discardResumeParse } from '@/app/onboarding/resume-actions'
import { Button } from '@/components/ui/button'
import { InlineLoadingState } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

// A reading that did not finish. The file is already stored, so "Try again" reads it again without a new upload;
// "Upload a different file" brings the upload form back. Both show a busy cursor and a working line while they run.
export function ResumeParseProblem({ fileName, stalled }: { fileName: string; stalled: boolean }) {
  const [pending, start] = useTransition()
  return (
    <div className={cn('space-y-4 rounded-lg border border-border p-5', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-base font-medium text-ink">We could not finish reading {fileName}.</p>
      <p className="text-sm text-muted-foreground">
        {stalled ? 'It took longer than it should have.' : 'Something went wrong on our side.'} Nothing you answered is lost. Try again, or choose a different file.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" disabled={pending} onClick={() => start(() => retryResumeParse())}>
          {pending ? 'One moment…' : 'Try again'}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => discardResumeParse())}
          className={cn('text-sm font-medium text-brand underline underline-offset-4', pending ? 'cursor-progress' : 'cursor-pointer')}
        >
          Upload a different file
        </button>
      </div>
      {pending && <InlineLoadingState label="Working on it…" />}
    </div>
  )
}
