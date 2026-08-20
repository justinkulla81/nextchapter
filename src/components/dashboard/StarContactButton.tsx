'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { toggleContactPriority } from '@/app/dashboard/network/actions'
import { cn } from '@/lib/utils'

// Same priority-star toggle as the Contact Directory table row, standalone
// for the contact profile page's header.
export function StarContactButton({ contactId, isPriority: initialIsPriority }: { contactId: string; isPriority: boolean }) {
  const [, startTransition] = useTransition()
  const [isPriority, setIsPriority] = useState(initialIsPriority)

  function handleClick() {
    const next = !isPriority
    setIsPriority(next)
    startTransition(async () => {
      await toggleContactPriority(contactId, next)
    })
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
