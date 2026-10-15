'use client'

import { useRouter } from 'next/navigation'

// A plain <select>: the number of stored months grows without bound, so it
// is a dropdown per design-principles.md (5+ options).
export function MonthPicker({ months, selected }: { months: Array<{ key: string; label: string }>; selected: string }) {
  const router = useRouter()
  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/support/admin/monthly-report?month=${e.target.value}`)}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      aria-label="Select report month"
    >
      {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  )
}
