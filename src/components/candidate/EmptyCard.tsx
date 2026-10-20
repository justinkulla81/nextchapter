import type { ReactNode } from 'react'

// An empty page says what it will hold, why that helps, and the one thing to do now.
export function EmptyCard({ title, why, action }: { title: string; why: string; action?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border p-6">
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      <p className="max-w-xl text-base text-muted-foreground">{why}</p>
      {action}
    </div>
  )
}
