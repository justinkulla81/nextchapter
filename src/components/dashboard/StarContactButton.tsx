'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { toggleContactPriority } from '@/app/dashboard/network/actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// Same priority-star toggle as the Contact Directory table row, standalone
// for the contact profile page's header. `labeled` is the redesigned look: a button
// that says what it does ("Star" or "Starred") and why, instead of a bare icon.
export function StarContactButton({ contactId, isPriority: initialIsPriority, labeled = false }: { contactId: string; isPriority: boolean; labeled?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [isPriority, setIsPriority] = useState(initialIsPriority)

  function handleClick() {
    const next = !isPriority
    setIsPriority(next)
    if (labeled) posthog.capture('contact_starred', { contactId, starred: next })
    startTransition(async () => {
      await toggleContactPriority(contactId, next)
    })
  }

  if (labeled) {
    return (
      <button
        type="button"
        aria-pressed={isPriority}
        onClick={handleClick}
        title={isPriority ? 'Starred people rise to the top of your list. Select to unstar.' : 'Star people you most want to write to. They rise to the top of your list.'}
        className={cn('inline-flex h-10 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted', pending && 'cursor-wait')}
      >
        <Star className={cn('size-4', isPriority && 'fill-ink')} aria-hidden />
        {isPriority ? 'Starred' : 'Star'}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label={isPriority ? 'Unmark as priority' : 'Mark as priority'}
      onClick={handleClick}
      className="text-muted-foreground hover:text-orange"
    >
      <Star className={cn('size-4', isPriority && 'fill-orange text-orange')} />
    </button>
  )
}
