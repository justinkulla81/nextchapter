'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const OPTIONS = [
  { value: 'ALL', label: 'All functions' },
  { value: 'TECH', label: 'Tech / Engineering' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'DATA', label: 'Data / Analytics' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'BUSINESS', label: 'Business / Operations' },
] as const

// URL is the only state (matches parseListParams' convention) — changing
// the filter navigates to a fresh query string rather than holding local
// component state, so a bookmarked/shared link reproduces the exact view.
export function CandidateFunctionFilter({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: string | null) {
    if (!value) return
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'ALL') params.delete('function')
    else params.set('function', value)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select one">
          {(value: string | null) => OPTIONS.find((o) => o.value === value)?.label ?? 'Select one'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
