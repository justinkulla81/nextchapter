'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { generateCoreStatement, generateStoryAdaptations } from '@/app/dashboard/interview-prep/actions'
import { cn } from '@/lib/utils'

// Writes the member's story and its spoken versions (the same two steps as Interview prep's My story, each its own call
// so neither runs into the function time limit), then reloads the page to show them.
export function WritePitchButton({ started }: { started: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tried, setTried] = useState(false)
  return (
    <div className={cn('space-y-2', pending && 'cursor-wait')}>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          posthog.capture('pitch_write_clicked', { started })
          startTransition(async () => {
            try {
              if (!started) await generateCoreStatement()
              await generateStoryAdaptations()
              posthog.capture('pitch_written', { started })
            } catch {
              posthog.capture('pitch_write_failed', { started })
            }
            setTried(true)
            router.refresh()
          })
        }}
        className={cn(
          'inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95',
          pending && 'cursor-wait opacity-70',
        )}
      >
        {pending ? 'Writing your pitch…' : 'Write my pitch'}
      </button>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending
          ? 'About 30 seconds. We use your strengths, references and résumé.'
          : tried
            ? 'If your pitch has not appeared, press the button again. Upload your résumé first if you have not.'
            : 'Takes about 30 seconds. Built from your strengths, references and résumé; you can change every word.'}
      </p>
    </div>
  )
}
