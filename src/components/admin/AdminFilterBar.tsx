'use client'

import { useRef } from 'react'

export interface AdminFilterOption {
  key: string
  label: string
  options: { value: string; label: string }[]
  value: string
}

// URL-search-param-driven search + filters — the query string is the only
// state (bookmarkable, shareable, no client-side filter state to lose).
// A plain <form method="get"> handles the search box natively (Enter
// submits); the one bit of real client JS is auto-submitting on a select
// change, since 5+ option filters render as dropdowns per design-principles.md.
export function AdminFilterBar({
  basePath,
  searchValue,
  searchPlaceholder = 'Search…',
  filters = [],
}: {
  basePath: string
  searchValue: string
  searchPlaceholder?: string
  filters?: AdminFilterOption[]
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      method="get"
      action={basePath}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
    >
      <input
        type="search"
        name="q"
        defaultValue={searchValue}
        placeholder={searchPlaceholder}
        className="h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      />
      {filters.map((filter) => (
        <select
          key={filter.key}
          name={filter.key}
          defaultValue={filter.value}
          onChange={() => formRef.current?.requestSubmit()}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        >
          <option value="">{filter.label}: All</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      <button
        type="submit"
        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
      >
        Filter
      </button>
      {(searchValue || filters.some((f) => f.value)) && (
        <a href={basePath} className="text-sm text-muted-foreground underline underline-offset-4">
          Clear
        </a>
      )}
    </form>
  )
}
