import { cn } from '@/lib/utils'
import { WORK_TYPE_CHIP, type WorkType } from '@/lib/jobs/work-type'

/** The job's kind of work and how it pays, e.g. "Contract · $175/hr" or "Advisory / board · Unpaid". */
export function WorkTypePayChips({ workType, pay, className }: { workType: WorkType; pay: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{WORK_TYPE_CHIP[workType]}</span>
      {pay && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            pay === 'Unpaid' ? 'bg-warning/15 text-warning' : pay === 'Equity only' ? 'bg-muted text-foreground' : 'bg-muted text-foreground'
          )}
        >
          {pay}
        </span>
      )}
    </span>
  )
}
