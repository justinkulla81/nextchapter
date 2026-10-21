'use client'

import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

/**
 * Marks a field filled from the member's résumé that they haven't confirmed yet
 * (resume-prefill.ts). Inside a confirm form it is the one-tap confirm: it submits
 * the form as it stands. Editing the field and confirming works the same way.
 */
export function FromResumeTag({
  show,
  section,
  fields,
  submits = true,
  className,
}: {
  show: boolean
  section: string
  fields: string[]
  /** False where saving needs more than this field (the screening questions): then it only labels. */
  submits?: boolean
  className?: string
}) {
  if (!show) return null
  const style = cn('inline-flex w-fit items-center rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-orange', className)
  if (!submits) return <span className={style}>From your résumé — check and save</span>
  return (
    <button
      type="submit"
      className={cn(style, 'cursor-pointer hover:bg-orange/25')}
      aria-label={`Confirm ${fields.length === 1 ? 'this' : 'these'} from your résumé`}
      onClick={() => posthog.capture('resume_prefill_confirm_clicked', { section, fields })}
    >
      From your résumé — confirm
    </button>
  )
}
