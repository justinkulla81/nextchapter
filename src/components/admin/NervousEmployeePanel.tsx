'use client'

import { useState, useTransition } from 'react'
import { viewNervousEmployeePanel } from '@/app/support/admin/(portal)/companies/[id]/actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Reason-gated view of the most sensitive metric on this page — see the
// guardrail comment at the top of src/lib/companies/nervous-employee-panel.ts.
// Nothing renders until a reason is submitted and the Server Action has
// logged the view; there is no way to see the count without that log entry
// existing first.
export function NervousEmployeePanel({ companyId }: { companyId: string }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ suppressed: boolean; count?: number } | null>(null)
  const [pending, startTransition] = useTransition()

  function handleView() {
    setError(null)
    startTransition(async () => {
      const res = await viewNervousEmployeePanel(companyId, reason)
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Could not load this data.')
        return
      }
      const cell = res.data.cell
      setResult('suppressed' in cell && cell.suppressed ? { suppressed: true } : { suppressed: false, count: (cell as { count: number }).count })
    })
  }

  return (
    <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-xs text-muted-foreground">
        Aggregate only — never drills down to individual members, never exported, never shared with this employer
        or anyone outside this admin surface. Every view is logged with your reason.
      </p>

      {result === null ? (
        <div className="space-y-2">
          <Label htmlFor="nervousEmployeeReason">Reason for viewing (required, logged)</Label>
          <Textarea
            id="nervousEmployeeReason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Evaluating this employer for the outplacement outreach shortlist."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" onClick={handleView} disabled={pending || !reason.trim()}>
            {pending ? 'Loading…' : 'View currently-searching count'}
          </Button>
        </div>
      ) : result.suppressed ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <p className="text-sm font-medium text-foreground">Insufficient data</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Fewer than 5 members currently at this employer are searching. No count is shown — a smaller number
            would identify specific people.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm">
            <span className="font-medium">{result.count} members</span> currently at this employer are actively
            searching, per this platform&apos;s own activity data.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Internal prioritization only. Never shared with this employer, never exported, never appears outside
            this admin page.
          </p>
        </div>
      )}
    </div>
  )
}
