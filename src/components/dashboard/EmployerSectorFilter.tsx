'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { boardHref } from '@/lib/jobs/board-url'
import { EMPLOYER_SECTORS, EMPLOYER_SECTOR_HINT, EMPLOYER_SECTOR_LABEL, sectorsParam, type EmployerSector } from '@/lib/jobs/employer-sector'
import { saveEmployerSectors } from '@/app/dashboard/search-strategy/sector-actions'

/**
 * Private / Government / Nonprofit / Academia: four on/off buttons, all on by
 * default. A change is saved as the member's preference (so job emails follow it
 * too) and written to the `sectors` URL parameter (so a reload or shared link keeps
 * it). On the board it re-renders the list; on Search strategy it just saves.
 */
export function EmployerSectorFilter({
  surface,
  shown,
  updateUrl = true,
}: {
  surface: 'find_my_job' | 'search_strategy'
  shown: EmployerSector[]
  updateUrl?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState<EmployerSector[]>(shown)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggle(sector: EmployerSector) {
    const next = current.includes(sector) ? current.filter((s) => s !== sector) : EMPLOYER_SECTORS.filter((s) => s === sector || current.includes(s))
    if (next.length === 0) {
      setError('Keep at least one sector on, or you will see no jobs.')
      return
    }
    setError(null)
    setSaved(false)
    setCurrent(next)
    posthog.capture('employer_sector_filter_changed', { sectors: next, surface, toggled: sector, on: next.includes(sector) })
    startTransition(async () => {
      const result = await saveEmployerSectors(next)
      if (!result.ok) {
        setError(result.error)
        setCurrent(current)
        return
      }
      setSaved(true)
      if (updateUrl) router.replace(boardHref(searchParams, { sectors: sectorsParam(next) }, { pathname }), { scroll: false })
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'cursor-wait')}>
      <span className="text-sm text-muted-foreground">Employers</span>
      <div role="group" aria-label="Employer sectors to show" className="flex flex-wrap gap-1">
        {EMPLOYER_SECTORS.map((s) => {
          const on = current.includes(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              disabled={pending}
              aria-pressed={on}
              aria-busy={pending}
              title={EMPLOYER_SECTOR_HINT[s]}
              className={cn(
                'rounded-md border px-2 py-1 text-sm',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground line-through',
                pending && 'cursor-wait'
              )}
            >
              {EMPLOYER_SECTOR_LABEL[s]}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && saved && !updateUrl && <p className="text-xs text-success">Saved — your board and job emails follow this.</p>}
    </div>
  )
}
