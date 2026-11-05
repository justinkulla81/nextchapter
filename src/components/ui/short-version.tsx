import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The pale box that opens a page: the facts in a line or two, so every claim below it says why. */
export function ShortVersion({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-tint-sky px-5 py-4', className)}>
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">The short version</p>
      <p className="mt-1 text-base leading-relaxed text-ink">{children}</p>
    </div>
  )
}
