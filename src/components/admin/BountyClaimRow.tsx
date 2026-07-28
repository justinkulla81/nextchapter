'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { approveBountyClaim, rejectBountyClaim, markBountyClaimPaid } from '@/app/support/admin/(portal)/bounty-claims/actions'
import { cn } from '@/lib/utils'

interface BountyClaimRowProps {
  id: string
  candidateName: string
  candidateEmail: string
  companyName: string
  roleTitle: string
  startDate: string
  paymentMethod: string | null
  paymentHandle: string | null
  status: string
  paidAt: string | null
  signedUrl: string | null
  createdAt: string
}

export function BountyClaimRow(claim: BountyClaimRowProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">
            {claim.candidateName} <span className="text-muted-foreground">({claim.candidateEmail})</span>
          </p>
          <p className="text-sm text-foreground">
            {claim.roleTitle} at {claim.companyName} — starts {claim.startDate}
          </p>
          <p className="text-xs text-muted-foreground">
            {claim.paymentMethod
              ? `Pay via ${claim.paymentMethod}${claim.paymentHandle ? ` (${claim.paymentHandle})` : ''}`
              : 'Payment method not yet confirmed'}{' '}
            · Submitted {claim.createdAt}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase',
            claim.status === 'APPROVED' && 'bg-success/10 text-success',
            claim.status === 'REJECTED' && 'bg-destructive/10 text-destructive',
            claim.status === 'PENDING' && 'bg-orange/10 text-orange'
          )}
        >
          {claim.status}
          {claim.paidAt ? ' · Paid' : ''}
        </span>
      </div>

      {claim.signedUrl && (
        <a href={claim.signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">
          View offer letter
        </a>
      )}

      {claim.status === 'PENDING' && !showRejectForm && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => approveBountyClaim(claim.id))}
          >
            Approve
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setShowRejectForm(true)}>
            Reject
          </Button>
        </div>
      )}

      {claim.status === 'PENDING' && showRejectForm && (
        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (shown to the candidate)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => startTransition(() => rejectBountyClaim(claim.id, reason))}
            >
              Confirm reject
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setShowRejectForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {claim.status === 'APPROVED' && !claim.paidAt && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(() => markBountyClaimPaid(claim.id))}
        >
          Mark as paid
        </Button>
      )}
    </div>
  )
}
