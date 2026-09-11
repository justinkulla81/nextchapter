'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Select-all for the current page.
 *
 * Scoped to the page on purpose: bulk actions read the ticked checkboxes, so
 * "select all 3,688" would be a promise the form cannot keep. If you want a
 * bigger selection, raise the page size — which is why 1500 is offered.
 *
 * Carries a real indeterminate state, because a half-filled box and an empty
 * one mean different things and a plain checkbox would show the same square
 * for both.
 */
export function CrmSelectAll({ pageCount }: { pageCount: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState(0)

  function boxes(): HTMLInputElement[] {
    const form = ref.current?.closest('form')
    if (!form) return []
    return [...form.querySelectorAll<HTMLInputElement>('input[name="selected"]')]
  }

  // Row checkboxes can also be ticked individually, so this listens to the
  // form rather than owning the state — otherwise the header box would drift
  // out of step with what is actually selected. sync lives inside the effect
  // so it is not a changing dependency on every render.
  useEffect(() => {
    const form = ref.current?.closest('form')
    if (!form) return
    const sync = () => {
      const all = [...form.querySelectorAll<HTMLInputElement>('input[name="selected"]')]
      setSelected(all.filter((b) => b.checked).length)
    }
    form.addEventListener('change', sync)
    sync()
    return () => form.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < pageCount
  }, [selected, pageCount])

  function toggle(next: boolean) {
    for (const b of boxes()) b.checked = next
    // The bulk bar counts on the form's change event, which setting .checked
    // in script does not fire.
    ref.current?.closest('form')?.dispatchEvent(new Event('change', { bubbles: true }))
    setSelected(next ? pageCount : 0)
  }

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={selected === pageCount && pageCount > 0}
      onChange={(e) => toggle(e.target.checked)}
      aria-label={
        selected === pageCount && pageCount > 0
          ? `Clear all ${pageCount} on this page`
          : `Select all ${pageCount} on this page`
      }
      title={selected > 0 ? `${selected} of ${pageCount} selected` : `Select all ${pageCount} on this page`}
    />
  )
}
