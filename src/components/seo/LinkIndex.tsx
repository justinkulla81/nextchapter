import Link from 'next/link'

/** A feed or a file is not a page: a plain anchor, so the router does not try to prefetch or render it. */
const isFile = (href: string) => /\.(xml|rss|csv|json)(\?|$)/.test(href) || href.startsWith('/feeds/')
function Anchor({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return isFile(href) ? <a href={href} className={className}>{children}</a> : <Link href={href} className={className}>{children}</Link>
}

export interface LinkIndexItem {
  href: string
  label: string
  note?: string
  /** A second, smaller link at the right of the row (a feed's own page). */
  extra?: { href: string; label: string }
}

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
        <li key={l.href} className="flex items-center border-b border-border/60 last:border-b-0">
          <Anchor href={l.href} className="flex min-h-11 flex-1 items-center justify-between gap-3 px-3 py-2 text-sm text-navy hover:text-brand sm:px-0">
            <span className="font-medium">{l.label}</span>
            {l.note ? <span className="shrink-0 text-xs text-muted-foreground">{l.note}</span> : !l.extra && <span aria-hidden className="text-muted-foreground">›</span>}
          </Anchor>
          {l.extra && <Link href={l.extra.href} className="shrink-0 px-3 py-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-brand sm:pr-0">{l.extra.label}</Link>}
        </li>
      ))}
    </ul>
  )
}

/**
 * Links grouped under a heading (a city, a category): each group is a small white panel with its own divided rows, flowing in
 * columns. The first `visibleGroups` show; the rest sit in a native <details>, so every link stays in the HTML.
 */
export function GroupedLinkIndex({ groups, visibleGroups = 12, label }: { groups: { heading: string; items: LinkIndexItem[] }[]; visibleGroups?: number; label: string }) {
  if (groups.length === 0) return null
  const head = groups.slice(0, visibleGroups)
  const rest = groups.slice(visibleGroups)
  return (
    <div className="mt-4">
      <Groups groups={head} label={label} />
      {rest.length > 0 && (
        <details className="group mt-3">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-full px-3 text-sm font-medium text-brand hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show all {groups.length} places</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <Groups groups={rest} label={`${label}, continued`} />
        </details>
      )}
    </div>
  )
}

function Groups({ groups, label }: { groups: { heading: string; items: LinkIndexItem[] }[]; label: string }) {
  return (
    <div aria-label={label} className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {groups.map((g) => (
        <section key={g.heading} className="mb-4 break-inside-avoid overflow-hidden rounded-xl bg-white">
          <h3 className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.heading}</h3>
          <ul className="px-4 pb-1">
            {g.items.map((l) => (
              <li key={l.href} className="border-b border-border/60 last:border-b-0">
                <Link href={l.href} className="flex min-h-11 items-center py-2 text-sm font-medium text-navy hover:text-brand">{l.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
