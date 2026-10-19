import type { ReactNode } from 'react'

// One list pattern for the redesign: each row is a title, one plain reason, one fact and up to two actions.
export interface RowItem {
  key: string
  title: string
  /** Makes the title an external link, for example to a course. */
  href?: string
  /** Why this row is here, in a plain sentence. */
  why?: string
  /** One fact: a date, a time, a count. */
  fact?: string
  actions?: ReactNode
  /** Opens under the row on demand. */
  detail?: ReactNode
  detailLabel?: string
}

export function RowList({ items, label }: { items: RowItem[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border rounded-2xl border border-border">
      {items.map((it) => (
        <li key={it.key} className="space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-64 space-y-0.5">
              <p className="text-base font-semibold text-ink">
                {it.href ? (
                  <a href={it.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {it.title}
                  </a>
                ) : (
                  it.title
                )}
              </p>
              {it.why && <p className="text-sm text-ink">{it.why}</p>}
              {it.fact && <p className="text-sm text-muted-foreground">{it.fact}</p>}
            </div>
            {it.actions && <div className="flex flex-wrap items-center gap-3">{it.actions}</div>}
          </div>
          {it.detail && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">{it.detailLabel ?? 'Why this matters'}</summary>
              <div className="mt-2 space-y-1 text-muted-foreground">{it.detail}</div>
            </details>
          )}
        </li>
      ))}
    </ul>
  )
}
