import Link from 'next/link'

export interface SortState {
  sort: string
  dir: 'asc' | 'desc'
}

/**
 * A sortable column heading.
 *
 * Sort state lives in the query string so a sorted view is bookmarkable and
 * survives an inline edit — client-side sorting would reset the moment the
 * page revalidated after a save.
 */
export function SortHeader({
  label, sortKey, current, basePath, params, defaultDir = 'asc', className,
}: {
  label: string
  sortKey: string
  current: SortState
  basePath: string
  params: Record<string, string>
  /** First click direction. Dates and scores read better newest/highest first. */
  defaultDir?: 'asc' | 'desc'
  className?: string
}) {
  const active = current.sort === sortKey
  const nextDir = active ? (current.dir === 'asc' ? 'desc' : 'asc') : defaultDir

  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
  qs.set('sort', sortKey)
  qs.set('dir', nextDir)
  qs.delete('page')

  return (
    <th className={className ?? 'px-3 py-2 font-medium'}>
      <Link
        href={`${basePath}?${qs.toString()}`}
        className="inline-flex items-center gap-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand"
        aria-sort={active ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <span aria-hidden className={active ? 'text-brand' : 'text-muted-foreground/40'}>
          {active ? (current.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </Link>
    </th>
  )
}

/** Reads sort state from search params, falling back to a default. */
export function readSort(
  sp: Record<string, string | undefined>,
  allowed: string[],
  fallback: SortState
): SortState {
  const sort = sp.sort && allowed.includes(sp.sort) ? sp.sort : fallback.sort
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : fallback.dir
  return { sort, dir }
}
