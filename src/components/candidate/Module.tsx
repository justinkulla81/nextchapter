import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// One card pattern for everything on a candidate page: a serif title, an optional action, a body.
// "dark" is reserved for the single navy block on a page.
export function Module({ title, action, tone = 'light', children, className }: { title: string; action?: ReactNode; tone?: 'light' | 'dark'; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4 rounded-2xl border p-6', tone === 'dark' ? 'border-ink bg-ink text-white' : 'border-border bg-white text-ink', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
