import Link from 'next/link'
import type { ReactNode } from 'react'

export interface AdminColumn<T> {
  header: string
  render: (row: T) => ReactNode
  className?: string
  /** If set, the header becomes a clickable link that sorts by this key. */
  sortKey?: string
}

export interface AdminPaginationInfo {
  page: number
  totalPages: number
  total: number
  /** Current query string params (minus `page`) to preserve across page links. */
  baseParams: Record<string, string>
  basePath: string
}

export interface AdminSortInfo {
  currentKey: string
  currentDir: 'asc' | 'desc'
  basePath: string
  /** Current query string params (minus `sort`/`dir`) to preserve across sort links. */
  baseParams: Record<string, string>
}

// Generic, server-rendered admin table — replaces the ad hoc `<table>`
// markup duplicated across MetricsTable.tsx and recruiter-database/page.tsx
// with one shared primitive every new admin list page builds on.
export function AdminDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nothing here yet.',
  pagination,
  sorting,
}: {
  columns: AdminColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  pagination?: AdminPaginationInfo
  sorting?: AdminSortInfo
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map((col) => (
                <th key={col.header} className={col.className ?? 'px-3 py-2 font-medium'}>
                  {col.sortKey && sorting ? (
                    <Link
                      href={buildSortHref(sorting, col.sortKey)}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      {sorting.currentKey === col.sortKey && (
                        <span aria-hidden="true">{sorting.currentDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </Link>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              // min-h-[var(--row-height-partner)] — Partners Master Build
              // Script §B3.4 base partner row height (40px). This table is
              // reused across most admin list pages, so this one edit is
              // the density token's widest reference implementation.
              <tr key={rowKey(row)} className="min-h-[var(--row-height-partner)] border-b border-border last:border-0">
                {columns.map((col) => (
                  <td key={col.header} className="px-3 py-2">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} — {pagination.total} total
          </span>
          <div className="flex gap-2">
            {pagination.page > 1 && (
              <Link
                href={buildPageHref(pagination.basePath, pagination.baseParams, pagination.page - 1)}
                className="rounded-md border border-border px-2 py-1 hover:bg-muted"
              >
                ← Previous
              </Link>
            )}
            {pagination.page < pagination.totalPages && (
              <Link
                href={buildPageHref(pagination.basePath, pagination.baseParams, pagination.page + 1)}
                className="rounded-md border border-border px-2 py-1 hover:bg-muted"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function buildPageHref(basePath: string, baseParams: Record<string, string>, page: number) {
  const params = new URLSearchParams({ ...baseParams, page: String(page) })
  return `${basePath}?${params.toString()}`
}

function buildSortHref(sorting: AdminSortInfo, key: string): string {
  const nextDir = sorting.currentKey === key && sorting.currentDir === 'asc' ? 'desc' : 'asc'
  const params = new URLSearchParams({ ...sorting.baseParams, sort: key, dir: nextDir })
  return `${sorting.basePath}?${params.toString()}`
}
