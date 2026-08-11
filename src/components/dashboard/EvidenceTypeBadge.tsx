import { EVIDENCE_TYPE_LABELS, type EvidenceType } from '@/lib/reports/evidence-type'
import { cn } from '@/lib/utils'

const EVIDENCE_TYPE_STYLES: Record<EvidenceType, string> = {
  self_reported: 'bg-muted text-muted-foreground',
  reference_verified: 'bg-success/10 text-success',
  verified_fact: 'bg-primary/10 text-primary',
  ai_inferred: 'bg-muted text-muted-foreground',
}

// The printed Executive Dossier reads as an attestation document, not a
// SaaS dashboard — no color-coded chips there. The pill renders on screen;
// print media swaps it for the same label as plain small-caps text.
export function EvidenceTypeBadge({ type, className }: { type: EvidenceType; className?: string }) {
  return (
    <>
      <span
        className={cn(
          'inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap print:hidden',
          EVIDENCE_TYPE_STYLES[type],
          className
        )}
      >
        {EVIDENCE_TYPE_LABELS[type]}
      </span>
      <span className="hidden text-[0.7rem] tracking-wide text-muted-foreground uppercase print:inline">
        {EVIDENCE_TYPE_LABELS[type]}
      </span>
    </>
  )
}
