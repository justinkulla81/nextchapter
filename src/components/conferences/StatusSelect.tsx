'use client'

import { useRef } from 'react'
import { posthog } from '@/lib/posthog/client'

// Seven or six options, so a dropdown, not buttons. Saves as soon as the choice changes: no extra button to hunt for.
export function StatusSelect({ action, hidden, options, value, label, none, event }: {
  action: (fd: FormData) => Promise<void>
  hidden: Record<string, string>
  options: readonly { value: string; label: string }[]
  value: string | null
  label: string
  none: string
  event: string
}) {
  const form = useRef<HTMLFormElement>(null)
  return (
    <form ref={form} action={action} className="inline-flex">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select
        name="status" aria-label={label} defaultValue={value ?? 'NONE'}
        onChange={(e) => { posthog.capture(event, { ...hidden, status: e.target.value }); form.current?.requestSubmit() }}
        className="h-10 rounded-full border border-border bg-background px-4 text-sm font-medium text-ink"
      >
        <option value="NONE">{none}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </form>
  )
}
