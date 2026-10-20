import type { ReactNode } from 'react'

// Every redesigned page opens the same way: one headline, one line saying what
// the page is for, and at most one primary action. Nothing else sits above the content.
export function PageHeader({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">{title}</h1>
        {intro && <p className="max-w-xl text-base text-muted-foreground">{intro}</p>}
      </div>
      {action}
    </header>
  )
}
