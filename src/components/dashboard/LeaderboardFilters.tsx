'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SENIORITY_BANDS, SENIORITY_BAND_LABEL } from '@/lib/leaderboard/boards'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

// PART FOUR §15 — "Segment by seniority band, optional secondary filter by
// function." 4 seniority bands -> adjacent buttons (design-principles.md:
// 2-4 discrete options render as buttons, not a dropdown). 15 function
// options -> a native <select> (5+ options rule). Both drive the URL's
// search params so the Stats page's server component can re-fetch filtered
// board results — no client-side board computation here at all.
export function LeaderboardFilters({ band, fn }: { band: string | null; fn: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function pushParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}#leaderboards`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant={!band ? 'default' : 'outline'} onClick={() => pushParam('band', null)}>
          Everyone
        </Button>
        {SENIORITY_BANDS.map((b) => (
          <Button key={b} type="button" size="sm" variant={band === b ? 'default' : 'outline'} onClick={() => pushParam('band', b)}>
            {SENIORITY_BAND_LABEL[b] ?? b}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Function
        <select
          className={cn(
            'rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary'
          )}
          value={fn ?? ''}
          onChange={(e) => pushParam('fn', e.target.value || null)}
        >
          <option value="">Any function</option>
          {PRIMARY_FUNCTION_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
