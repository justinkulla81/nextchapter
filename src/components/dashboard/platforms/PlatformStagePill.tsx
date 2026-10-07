import { cn } from '@/lib/utils'
import type { PlatformStatus } from '@/lib/platforms/candidate-view'

const TONE: Record<PlatformStatus['tone'], string> = {
  progress: 'bg-brand/10 text-brand',
  done: 'bg-success/10 text-success',
  warning: 'bg-warning/20 text-foreground',
  muted: 'bg-muted text-muted-foreground',
}

// The candidate's stage on a fractional work platform or learning provider,
// read from that platform's own email. "Gone quiet" and the like replace
// the color but keep the stage, so "Accepted · Gone quiet" still says how
// far they got.
export function PlatformStagePill({ status, className }: { status: PlatformStatus; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONE[status.tone], className)}
      title="Detected from this platform’s own email in your connected Gmail"
    >
      {status.label}
      {status.healthLabel && <span className="font-normal">&nbsp;·&nbsp;{status.healthLabel}</span>}
    </span>
  )
}
