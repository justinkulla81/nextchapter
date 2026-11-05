import { cn } from '@/lib/utils'

/** The week's effort as one big number with its reason, in a pale box. It replaces the minutes line in the Home eyebrow; it adds no card. */
export function FocusNumber({ done, target, className }: { done: number; target: number; className?: string }) {
  const toGo = Math.max(0, target - done)
  return (
    <div className={cn('inline-flex flex-col rounded-2xl bg-tint-sky px-5 py-3.5', className)}>
      <p className="font-display text-4xl leading-none font-bold tracking-tight text-navy tabular-nums">
        {done} <span className="text-xl font-semibold text-muted-foreground">of {target}</span>
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        minutes of search work this week{toGo > 0 ? `, ${toGo} to go` : ', target reached'}
      </p>
    </div>
  )
}
