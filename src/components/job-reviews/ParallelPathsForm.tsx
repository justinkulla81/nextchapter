'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ToggleChips } from '@/components/job-reviews/ToggleChips'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { submitParallelPaths } from '@/app/dashboard/past-jobs/actions'
import { PARALLEL_PATHS } from '@/lib/job-reviews/constants'

/** "Are you doing anything alongside the search right now?" — multi-select, or explicitly nothing. */
export function ParallelPathsForm({ initial }: { initial: string[] | null }) {
  const router = useRouter()
  const [paths, setPaths] = useState<string[]>(initial ?? [])
  const [answeredNothing, setAnsweredNothing] = useState(initial !== null && initial.length === 0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const canSave = paths.length > 0 || answeredNothing

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await submitParallelPaths(paths)
      if (!result.ok) return setError(result.error)
      posthog.capture('parallel_paths_saved', { paths: result.paths, pathCount: result.paths.length, edited: initial !== null })
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')} aria-busy={pending}>
      <ToggleChips
        label="What you are doing alongside your search"
        options={PARALLEL_PATHS}
        value={paths}
        onChange={(next) => {
          setSaved(false)
          setPaths(next)
          if (next.length > 0) setAnsweredNothing(false)
        }}
      />
      <div>
        <Button
          variant={answeredNothing ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={answeredNothing}
          onClick={() => {
            setSaved(false)
            setPaths([])
            setAnsweredNothing(true)
          }}
        >
          Nothing alongside my search
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending || !canSave} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
          {pending ? 'Saving…' : initial !== null ? 'Save changes' : 'Save answer'}
        </Button>
        {!canSave && <span className="text-xs text-muted-foreground">Pick what you are doing, or choose &quot;Nothing alongside my search&quot;.</span>}
        {saved && <span className="text-sm text-success">Saved.</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
