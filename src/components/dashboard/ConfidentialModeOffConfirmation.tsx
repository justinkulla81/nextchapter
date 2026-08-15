'use client'

import { Button } from '@/components/ui/button'
import { CONFIDENTIAL_MODE_HIDDEN_ITEMS } from '@/lib/constants/confidential-mode-copy'

// Shared "here's exactly what becomes visible" confirmation block for
// turning Confidential Search Mode off (spec §3) — extracted from
// ConfidentialModeToggle so the Passive-to-Active prompt's "Something's
// changed" button (§10) can show the identical flow instead of building a
// second, different toggle-off path. Both callers still go through the same
// server action (setConfidentialSearchMode in
// src/app/dashboard/privacy/actions.ts); this component only renders the
// confirmation UI and reports back which button was pressed.
export function ConfidentialModeOffConfirmation({
  pending,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm — turn it off',
}: {
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
}) {
  return (
    <div className="max-w-md space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">Turning this off makes visible:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {CONFIDENTIAL_MODE_HIDDEN_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={pending} onClick={onConfirm}>
          {pending ? 'Turning off…' : confirmLabel}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
