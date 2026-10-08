'use client'

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
  return (
    <fieldset className="grid gap-1.5 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Mailing lists</legend>
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
