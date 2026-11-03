import Link from 'next/link'

export interface LinkIndexItem { href: string; label: string; note?: string }

/**
 * A long list of links, laid out as a directory instead of a wall of underlined phrases: one quiet panel, a fine divider
 * between rows, the note at the right of its row. The first `visible` rows show; the rest sit in a native <details> that
 * is in the HTML either way, so every link stays crawlable and keyboard-reachable.
 */
export function LinkIndex({ items, visible = 12, label }: { items: LinkIndexItem[]; visible?: number; label: string }) {
  if (items.length === 0) return null
  const head = items.slice(0, visible)
  const rest = items.slice(visible)
  return (
    <div className="mt-4">
      <Rows items={head} label={label} />
      {rest.length > 0 && (
        <details className="group mt-2">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-full px-3 text-sm font-medium text-brand hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show all {items.length}</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <Rows items={rest} label={`${label}, continued`} />
        </details>
      )}
    </div>
  )
}

function Rows({ items, label }: { items: LinkIndexItem[]; label: string }) {
  return (
    <ul aria-label={label} className="grid overflow-hidden rounded-xl bg-white sm:grid-cols-2 sm:gap-x-8 sm:px-4 lg:grid-cols-3">
      {items.map((l) => (
        <li key={l.href} className="border-b border-border/60 last:border-b-0">
          <Link href={l.href} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm text-navy hover:text-brand sm:px-0">
            <span className="font-medium">{l.label}</span>
            {l.note ? <span className="shrink-0 text-xs text-muted-foreground">{l.note}</span> : <span aria-hidden className="text-muted-foreground">›</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
