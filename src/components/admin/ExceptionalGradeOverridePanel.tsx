'use client'

import { useState, useTransition } from 'react'
import { setExceptionalGradeOverride } from '@/app/support/admin/(portal)/pedigree-signals/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ExceptionalGradeOverridePanelProps {
  candidateId: string
  active: boolean
  reason: string | null
  by: string | null
  at: Date | null
}

export function ExceptionalGradeOverridePanel({ candidateId, active, reason, by, at }: ExceptionalGradeOverridePanelProps) {
  const [draftReason, setDraftReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleGrant() {
    setError(null)
    startTransition(async () => {
      const result = await setExceptionalGradeOverride(candidateId, true, draftReason)
      if (result?.error) setError(result.error)
    })
  }

  function handleRevoke() {
    setError(null)
    startTransition(async () => {
      await setExceptionalGradeOverride(candidateId, false, '')
    })
  }

  if (active) {
    return (
      <div className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <p className="text-sm">
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            Exceptional Profile — grade forced to A
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Granted by {by} on {at?.toLocaleString()}
        </p>
        <p className="text-sm text-foreground">&ldquo;{reason}&rdquo;</p>
        <Button type="button" variant="outline" size="sm" onClick={handleRevoke} disabled={pending}>
          Revoke override
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-muted-foreground">
        For the rare, obviously-exceptional profile (sitting C-suite, etc.) where waiting on a live Search Sprint
        week to clear the normal weekly-activity gate would be absurd. This bypasses that gate only — the six
        category scores underneath are still computed normally.
      </p>
      <Label htmlFor="overrideReason">Reason (required, logged)</Label>
      <Textarea
        id="overrideReason"
        rows={3}
        value={draftReason}
        onChange={(e) => setDraftReason(e.target.value)}
        placeholder="e.g. Current CEO of a Series C company; obviously not gated on Search Sprint activity."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" onClick={handleGrant} disabled={pending || !draftReason.trim()}>
        Grant Exceptional Profile override
      </Button>
    </div>
  )
}
