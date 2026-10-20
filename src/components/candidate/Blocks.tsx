import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Small building blocks for redesigned pages that replace the legacy Card / small-caps label / dashed-box look.
// A section is a serif title, one line saying why it is here, and plain content. No card chrome unless it is the verdict.

/** A titled section without a box. `why` is the one-line reason the section exists. */
export function SectionBlock({ id, title, why, children, className }: { id: string; title: string; why?: string; children?: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <h2 id={id} className="font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        {why && <p className="max-w-2xl text-base text-muted-foreground">{why}</p>}
      </div>
      {children}
    </section>
  )
}

/** The one boxed block on a page: a headline, the reason behind it, and the facts or action that follow. */
export function VerdictPanel({ id, title, because, children }: { id: string; title: string; because?: ReactNode; children?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-2xl border border-border p-7">
      <h2 id={id} className="font-display text-2xl font-semibold text-ink">
        {title}
      </h2>
      {because && <p className="max-w-2xl text-base text-muted-foreground">{because}</p>}
      {children}
    </section>
  )
}

export interface Figure {
  value: string
  label: string
}

/** A few big numbers, each with a plain label. Three at most reads at a glance. */
export function Figures({ items, label }: { items: Figure[]; label: string }) {
  return (
    <dl aria-label={label} className="flex flex-wrap gap-x-10 gap-y-4">
      {items.map((f) => (
        <div key={f.label}>
          <dd className="text-2xl font-semibold text-ink tabular-nums">{f.value}</dd>
          <dt className="text-sm text-muted-foreground">{f.label}</dt>
        </div>
      ))}
    </dl>
  )
}

/** Body copy at reading size. */
export function PlainNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('max-w-2xl text-base text-ink', className)}>{children}</p>
}

/** An empty state in words: what will be here and why it helps. No dashed box. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-base text-muted-foreground">{children}</p>
}

/** Where a figure comes from. Small, because it is a reference, not content. */
export function SourceLine({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-sm text-muted-foreground">{children}</p>
}

/** A flat list of "name ... fact" lines with hairline dividers, for short lists that need no actions. */
export function FactList({ items, label }: { items: { key: string; name: ReactNode; fact?: ReactNode }[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {items.map((i) => (
        <li key={i.key} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
          <span className="text-base text-ink">{i.name}</span>
          {i.fact && <span className="text-sm text-muted-foreground">{i.fact}</span>}
        </li>
      ))}
    </ul>
  )
}
