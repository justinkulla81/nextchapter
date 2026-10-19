import type { ReactNode } from 'react'
import { Avatar } from './ui'

// A row carries a title, one reason, one fact and up to two actions. Detail opens on demand.
export function ListRow({ name, title, why, fact, actions }: { name?: string; title: ReactNode; why?: ReactNode; fact?: ReactNode; actions?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 flex-1 gap-4">
        {name && <Avatar name={name} />}
        <div className="min-w-0 space-y-0.5">
          <p className="text-base font-semibold text-ink">{title}</p>
          {why && <p className="text-sm text-ink">{why}</p>}
          {fact && <p className="text-sm text-muted-foreground">{fact}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  )
}

export function RowList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-border rounded-2xl border border-border">
      {children}
    </ul>
  )
}
