'use client'

import { useEffect, useRef } from 'react'

const SEARCH_DEBOUNCE_MS = 350

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
export interface AdminDateRangeFilter {
  afterKey: string
  beforeKey: string
  afterValue: string
  beforeValue: string
  /** Shown as a label before the two date inputs, e.g. "Effective". */
  label: string
}

export function AdminFilterBar({
  basePath,
  searchValue,
  searchPlaceholder = 'Search…',
  filters = [],
  dateRange,
  clearHref,
}: {
  basePath: string
  searchValue: string
  searchPlaceholder?: string
  filters?: AdminFilterOption[]
  dateRange?: AdminDateRangeFilter
  /** Where "Clear" goes. Defaults to the bare list. A list that REMEMBERS
   * its filters (see StickyFilters) needs an explicit reset target instead,
   * or clearing lands on the bare URL and is redirected straight back to
   * the view it was trying to leave. */
  clearHref?: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Was Enter-or-click-Filter only — every keystroke now re-submits after a
  // short pause, same debounce pattern as CrmIntroPaths' connector search.
  // Still a real GET navigation (bookmarkable, back-button-safe), just
  // triggered without an extra step.
  function onSearchType() {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => formRef.current?.requestSubmit(), SEARCH_DEBOUNCE_MS)
  }

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current) }, [])

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
        onChange={onSearchType}
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
      {dateRange && (
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {dateRange.label}
          <input
            type="date"
            name={dateRange.afterKey}
            defaultValue={dateRange.afterValue}
            aria-label={`${dateRange.label} after`}
            onChange={() => formRef.current?.requestSubmit()}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <span aria-hidden>–</span>
          <input
            type="date"
            name={dateRange.beforeKey}
            defaultValue={dateRange.beforeValue}
            aria-label={`${dateRange.label} before`}
            onChange={() => formRef.current?.requestSubmit()}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
      )}
      <button
        type="submit"
        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
      >
        Filter
      </button>
      {(searchValue || filters.some((f) => f.value) || (dateRange && (dateRange.afterValue || dateRange.beforeValue))) && (
        <a href={clearHref ?? basePath} className="text-sm text-muted-foreground underline underline-offset-4">
          Clear
        </a>
      )}
    </form>
  )
}
