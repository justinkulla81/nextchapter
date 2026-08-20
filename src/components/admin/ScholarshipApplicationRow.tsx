'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  approveScholarshipApplication,
  rejectScholarshipApplication,
} from '@/app/support/admin/(portal)/scholarship-applications/actions'
import { cn } from '@/lib/utils'

interface ScholarshipApplicationRowProps {
  id: string
  candidateName: string
  candidateEmail: string
  tier: string
  story: string
  status: string
  decisionNote: string | null
  createdAt: string
}

export function ScholarshipApplicationRow(application: ScholarshipApplicationRowProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">
            {application.candidateName} <span className="text-muted-foreground">({application.candidateEmail})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Requesting {application.tier} · Submitted {application.createdAt}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase',
            application.status === 'APPROVED' && 'bg-success/10 text-success',
            application.status === 'REJECTED' && 'bg-destructive/10 text-destructive',
            application.status === 'PENDING' && 'bg-orange/10 text-orange'
          )}
        >
          {application.status}
        </span>
      </div>

      <p className="whitespace-pre-wrap rounded-md bg-off-white p-3 text-sm text-foreground">{application.story}</p>

      {application.decisionNote && (
        <p className="text-xs text-muted-foreground">Decision note: {application.decisionNote}</p>
      )}

      {application.status === 'PENDING' && !showRejectForm && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => approveScholarshipApplication(application.id))}
          >
            Approve
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setShowRejectForm(true)}>
            Reject
          </Button>
        </div>
      )}

      {application.status === 'PENDING' && showRejectForm && (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Decision note (shown to the candidate)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => startTransition(() => rejectScholarshipApplication(application.id, note))}
            >
              Confirm reject
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
