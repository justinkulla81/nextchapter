'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reportWrongDetection, removeJobApplication } from '@/app/dashboard/email-activity/actions'

const NOT_A: Record<string, [string, string]> = {
  REJECTION: ['NOT_A_REJECTION', 'Not a rejection'],
  INTERVIEW_INVITE: ['NOT_AN_INTERVIEW', 'Not an interview'],
  OFFER: ['NOT_AN_OFFER', 'Not an offer'],
  APPLICATION_CONFIRMATION: ['NOT_AN_APPLICATION', 'Not an application'],
  APPLICATION: ['NOT_AN_APPLICATION', 'Not an application'],
}

/**
 * The ✕ on a detected item, asking why it's wrong. The reason (and the rule
 * that misfired, recorded server-side) is what lets the detection be fixed
 * for everyone rather than hidden once.
 */
export function DetectionRemoveButton({
  id, kind, detectedAs,
}: {
  id: string
  kind: 'email' | 'application'
  detectedAs: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const reasons: [string, string][] = [
    ...(NOT_A[detectedAs] ? [NOT_A[detectedAs]] : []),
    ['NOT_JOB_RELATED', 'Not job-related'],
    ['DUPLICATE', 'Duplicate'],
    ['WRONG_COMPANY', 'Wrong company'],
  ]

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Not right? Remove it and tell us why"
        aria-label="Remove — this was detected wrongly"
        className="h-6 shrink-0 rounded px-2 text-xs text-muted-foreground hover:bg-muted"
      >
        ✕
      </button>
    )
  }
  return (
    <span className="flex flex-wrap justify-end gap-1" role="group" aria-label="Why is this wrong?">
      {reasons.map(([value, label]) => (
        <button
          key={value}
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            if (kind === 'email') await reportWrongDetection(id, value)
            else await removeJobApplication(id, value)
            router.refresh()
          })}
          className={`rounded-md border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted ${pending ? 'cursor-progress opacity-60' : ''}`}
        >
          {label}
        </button>
      ))}
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-[11px] text-muted-foreground underline">
        Cancel
      </button>
    </span>
  )
}
