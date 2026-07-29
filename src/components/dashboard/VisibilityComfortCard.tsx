'use client'

import { useState, useTransition } from 'react'
import type { PublicDisclosureComfort } from '@prisma/client'
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
  { value: 'FULLY_COMFORTABLE', label: 'Fully comfortable being public' },
]

export function VisibilityComfortCard({
  initialComfort,
}: {
  initialComfort: PublicDisclosureComfort | null
}) {
  const [comfort, setComfort] = useState<PublicDisclosureComfort | null>(initialComfort)
  const [isPending, startTransition] = useTransition()

  function handleSelect(value: PublicDisclosureComfort) {
    setComfort(value)
    startTransition(() => {
      checkInVisibilityComfort(value)
    })
  }

  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <CardTitle className="text-base font-medium text-foreground">
          How comfortable do you feel being publicly visible in your search this week?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {WEEKLY_COMFORT_OPTIONS.map((option) => {
            const isSelected = comfort === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={isPending}
                onClick={() => handleSelect(option.value)}
                aria-pressed={isSelected}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait',
                  isSelected
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-input bg-white text-foreground hover:border-brand/40'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
