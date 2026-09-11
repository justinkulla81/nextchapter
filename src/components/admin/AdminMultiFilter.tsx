'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

/**
 * A multi-select filter that lives in the query string.
 *
 * Values are comma-separated so a filtered view stays bookmarkable and
 * shareable, which a client-side selection would not be. Rendered as toggle
 * chips rather than a multi-select box: a native multi-select needs a modifier
 * key most people never discover, and these sets are small enough to show.
 */
export function AdminMultiFilter({
  param, label, options,
}: {
  param: string
  label: string
  options: { value: string; label: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const active = new Set((search.get(param) ?? '').split(',').filter(Boolean))

  function toggle(value: string) {
    const next = new Set(active)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    const params = new URLSearchParams(search.toString())
    if (next.size > 0) params.set(param, [...next].join(','))
    else params.delete(param)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((o) => {
        const on = active.has(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              on ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'
            }`}
          >
            {o.label}
          </button>
        )
      })}
      {active.size > 0 && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(search.toString())
            params.delete(param); params.delete('page')
            router.push(`${pathname}?${params.toString()}`)
          }}
          className="text-xs text-muted-foreground underline"
        >
          clear
        </button>
      )}
    </fieldset>
  )
}
