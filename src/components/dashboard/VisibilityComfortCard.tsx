'use client'

import { useState, useTransition } from 'react'
import type { PublicDisclosureComfort } from '@prisma/client'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkInVisibilityComfort } from '@/app/dashboard/actions'
import { cn } from '@/lib/utils'

// Shorter than the onboarding question's phrasing (PUBLIC_DISCLOSURE_COMFORT_OPTIONS,
// src/lib/constants/onboarding.ts) — same 4 underlying values, but this is a
// quick weekly re-check, not the first time the candidate is answering it.
const WEEKLY_COMFORT_OPTIONS: { value: PublicDisclosureComfort; label: string }[] = [
  { value: 'PRIVATE_ONLY', label: 'Keeping this private' },
  { value: 'CLOSE_CONTACTS_ONLY', label: 'Close contacts only' },
  { value: 'BECOMING_COMFORTABLE', label: 'Getting more comfortable' },
  { value: 'FULLY_COMFORTABLE', label: 'Completely comfortable being public' },
]

export function VisibilityComfortCard({
  initialComfort,
}: {
  initialComfort: PublicDisclosureComfort | null
}) {
  const [comfort, setComfort] = useState<PublicDisclosureComfort | null>(initialComfort)
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(false)

  function handleSelect(value: PublicDisclosureComfort) {
    setComfort(value)
    startTransition(() => {
      checkInVisibilityComfort(value)
    })
  }

  // Once answered this week, the card disappears entirely rather than
  // sticking around in a "You said: X" state — initialComfort is re-derived
  // from the current week's WeeklySprint on every page load, so this
  // naturally reappears once a new week's sprint has visibilityComfort: null
  // again. No separate "next week" logic needed.
  if (dismissed || comfort) return null

  return (
    <Card aria-busy={isPending}>
      <CardHeader className="relative">
        <div className="flex items-center gap-2 pr-6">
          <CardTitle className="text-base font-medium text-foreground">
            How comfortable do you feel being publicly visible in your search this week?
          </CardTitle>
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            +5 pts
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {WEEKLY_COMFORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'rounded-md border border-input bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40 disabled:cursor-wait'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
