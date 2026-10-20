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
export function ToolsChecklist({
  options,
  aiOptions = [],
  confirmedAt,
}: {
  options: { name: string; checked: boolean }[]
  /** AI tools and skills postings in their function name most (tools-checklist.ts suggestAiOptions). */
  aiOptions?: { name: string; checked: boolean }[]
  confirmedAt: string | null
}) {
  const [checked, setChecked] = useState(() => new Set([...options, ...aiOptions].filter((o) => o.checked).map((o) => o.name)))
  const [saved, setSaved] = useState<string | null>(confirmedAt)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  if (options.length === 0 && aiOptions.length === 0) return null

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
      const r = await saveConfirmedTools([...checked], [...options, ...aiOptions].map((o) => o.name)).catch(() => null)
      if (!r?.ok) {
        setError(r?.error ?? 'Could not save your tools. Try again in a moment.')
        return
      }
      const ai = aiOptions.filter((o) => checked.has(o.name)).map((o) => o.name)
      posthog.capture('tools_confirmed', { count: checked.size, aiCount: ai.length, aiNames: ai })
      setSaved(new Date().toISOString())
      startRetune('tools')
    })
  }

  return (
    <div id="tools" className={cn('scroll-mt-24 space-y-2', pending && 'cursor-wait')}>
      <p className="text-sm font-medium text-foreground">Tools you use</p>
      <p className="text-sm text-muted-foreground">Tick the ones you work with — we compare them with the tools each job asks for.</p>
      {options.length > 0 && <Chips label="Tools you use" options={options} checked={checked} toggle={toggle} />}
      {aiOptions.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-foreground">AI you use</p>
          <p className="text-sm text-muted-foreground">
            The AI tools and skills jobs in your field ask for most. Tick the ones you use at work — jobs that ask for one you haven&apos;t ticked show it as a gap.
          </p>
          <Chips label="AI tools and skills you use" options={aiOptions} checked={checked} toggle={toggle} />
        </div>
      )}
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

function Chips({ label, options, checked, toggle }: { label: string; options: { name: string }[]; checked: Set<string>; toggle: (name: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
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
  )
}
