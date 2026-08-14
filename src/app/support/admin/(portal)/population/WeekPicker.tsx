'use client'

import { useRouter } from 'next/navigation'

// Week picker for report history — a plain <select>, per design-principles.md
// ("5+ options -> dropdown"), since the number of recorded weeks grows
// without bound. Auto-navigates on change, same convention as
// AdminFilterBar's auto-submitting selects.
export function WeekPicker({
  weeks,
  selected,
  basePath,
  mode,
}: {
  weeks: string[] // ISO date strings, newest first
  selected: string
  basePath: string
  mode: string
}) {
  const router = useRouter()

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`${basePath}?mode=${mode}&week=${e.target.value}`)}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      aria-label="Select report week"
    >
      {weeks.map((w) => (
        <option key={w} value={w}>
          Week of {new Date(w).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        </option>
      ))}
    </select>
  )
}
