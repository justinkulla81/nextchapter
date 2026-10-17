'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { saveConfirmedTools } from '@/app/dashboard/skills-assessment/tools-actions'
import { startRetune } from '@/components/dashboard/RetuneMoment'

/**
 * "Tools you use": tick the tools you work with. The ones your résumé or LinkedIn already
 * name are ticked for you, so this is mostly confirming. Job matches compare them with the
 * tools each posting names.
 */
export function ToolsChecklist({ options, confirmedAt }: { options: { name: string; checked: boolean }[]; confirmedAt: string | null }) {
  const [checked, setChecked] = useState(() => new Set(options.filter((o) => o.checked).map((o) => o.name)))
  const [saved, setSaved] = useState<string | null>(confirmedAt)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  if (options.length === 0) return null

  const toggle = (name: string) =>
    setChecked((c) => {
      const n = new Set(c)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })

  function save() {
    setError(null)
    startTransition(async () => {
      const r = await saveConfirmedTools([...checked], options.map((o) => o.name)).catch(() => null)
      if (!r?.ok) {
        setError(r?.error ?? 'Could not save your tools. Try again in a moment.')
        return
      }
      posthog.capture('tools_confirmed', { count: checked.size })
      setSaved(new Date().toISOString())
      startRetune('tools')
    })
  }

  return (
    <div id="tools" className={cn('scroll-mt-24 space-y-2', pending && 'cursor-wait')}>
      <p className="text-sm font-medium text-foreground">Tools you use</p>
      <p className="text-sm text-muted-foreground">Tick the ones you work with — we compare them with the tools each job asks for.</p>
      <div role="group" aria-label="Tools you use" className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.name}
            type="button"
            aria-pressed={checked.has(o.name)}
            onClick={() => toggle(o.name)}
            className={cn('rounded-full border px-3 py-1 text-sm', checked.has(o.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground')}
          >
            {o.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : `Save my tools (${checked.size})`}
        </Button>
        {saved && !error && <span className="text-xs text-muted-foreground">Saved — your job matches use these.</span>}
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
    </div>
  )
}
