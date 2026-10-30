'use client'

import { LIST_GROUPS } from '@/lib/mailing/suggest'
import { posthog } from '@/lib/posthog/client'

export interface ListOption {
  id: string
  key: string
  name: string
  audience: string | null
}

/** Checkboxes for choosing lists; suggested ones carry a small tag. */
export function MailingListChecklist({
  lists,
  value,
  onChange,
  suggested = [],
  name,
  disabled,
}: {
  lists: ListOption[]
  value: string[]
  onChange?: (ids: string[]) => void
  suggested?: string[]
  /** When set, renders form inputs instead of being controlled. */
  name?: string
  disabled?: boolean
}) {
  // One send can target a whole group (every employer list, every higher-ed list); the roster counts each address once.
  const groups = onChange ? LIST_GROUPS.map((g) => ({ label: g.label, ids: lists.filter((l) => g.keys.includes(l.key)).map((l) => l.id) })).filter((g) => g.ids.length > 1) : []
  return (
    <fieldset className="grid gap-1.5 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Mailing lists</legend>
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {groups.map((g) => {
            const all = g.ids.every((id) => value.includes(id))
            return (
              <button
                key={g.label}
                type="button"
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50"
                onClick={() => { posthog.capture('mailing_list_group_toggled', { group: g.label, listCount: g.ids.length, selected: !all }); onChange?.(all ? value.filter((v) => !g.ids.includes(v)) : [...new Set([...value, ...g.ids])]) }}
              >
                {all ? `Clear ${g.label.toLowerCase()}` : `Select ${g.label.toLowerCase()}`}
              </button>
            )
          })}
        </div>
      )}
      {lists.map((l) => {
        const checked = value.includes(l.id)
        return (
          <label key={l.id} className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted/50">
            <input
              type="checkbox"
              className="mt-0.5"
              {...(name ? { name, value: l.id, defaultChecked: checked } : { checked, onChange: () => onChange?.(checked ? value.filter((v) => v !== l.id) : [...value, l.id]) })}
            />
            <span>
              <span className="font-medium">{l.name}</span>
              {suggested.includes(l.key) && <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">suggested</span>}
              {l.audience && <span className="block text-xs text-muted-foreground">{l.audience}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
