import Link from 'next/link'

export const PAGE_SIZES = [50, 100, 200, 1500] as const
export const DEFAULT_PAGE_SIZE = 100

/** Reads a page size from search params, falling back to the default. */
export function readPageSize(raw: string | undefined): number {
  const n = parseInt(raw ?? '', 10)
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
}

/**
 * Row-count control.
 *
 * 1500 is offered and deliberately listed last: it exists for a bulk pass over
 * a filtered set and renders that many rows of inline controls, which is
 * noticeably slow. Naming it "all" would hide the cost.
 */
export function PageSizePicker({
  basePath, params, current, label = 'rows',
}: {
  basePath: string
  params: Record<string, string>
  current: number
  label?: string
}) {
  const href = (n: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
    qs.set('per', String(n))
    qs.delete('page')
    return `${basePath}?${qs.toString()}`
  }

  return (
    <div className="flex items-center gap-1 text-xs" role="group" aria-label={`Number of ${label} per page`}>
      <span className="text-muted-foreground">Show</span>
      {PAGE_SIZES.map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={current === n ? 'page' : undefined}
          className={`rounded-md border px-2 py-1 ${
            current === n ? 'border-brand bg-brand/10 font-semibold text-brand' : 'border-border hover:bg-muted'
          }`}
        >
          {n}
        </Link>
      ))}
    </div>
  )
}
