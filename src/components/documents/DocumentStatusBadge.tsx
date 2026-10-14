import { cn } from '@/lib/utils'
import { DOCUMENT_STATUS_LABEL, REQUESTER_STATUS_LABEL, isDocumentStatus } from '@/lib/documents/status'

// Text carries the meaning; the outline weight only reinforces it, so it still reads in greyscale.
export function DocumentStatusBadge({ status, audience }: { status: string; audience: 'candidate' | 'requester' }) {
  const known = isDocumentStatus(status)
  const labels = audience === 'candidate' ? DOCUMENT_STATUS_LABEL : REQUESTER_STATUS_LABEL
  const attention = known && (audience === 'candidate' ? status === 'REQUESTED' || status === 'NEEDS_CHANGES' : status === 'UPLOADED')
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', attention ? 'border-foreground text-foreground' : 'border-border text-muted-foreground')}>
      {known ? labels[status] : status}
    </span>
  )
}
