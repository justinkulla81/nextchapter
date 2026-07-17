import { EVIDENCE_TYPE_LABELS, type EvidenceType } from '@/lib/reports/evidence-type'
import { cn } from '@/lib/utils'

const EVIDENCE_TYPE_STYLES: Record<EvidenceType, string> = {
  self_reported: 'bg-muted text-muted-foreground',
  reference_verified: 'bg-success/10 text-success',
  verified_fact: 'bg-primary/10 text-primary',
  ai_inferred: 'bg-muted text-muted-foreground',
}

export function EvidenceTypeBadge({ type, className }: { type: EvidenceType; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap',
        EVIDENCE_TYPE_STYLES[type],
        className
      )}
    >
      {EVIDENCE_TYPE_LABELS[type]}
    </span>
  )
}
