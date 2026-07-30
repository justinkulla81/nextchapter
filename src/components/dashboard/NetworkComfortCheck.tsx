'use client'

import type { NetworkComfortLevel } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { setNetworkComfortLevel } from '@/app/dashboard/network/actions'

const OPTIONS: { value: NetworkComfortLevel; label: string }[] = [
  { value: 'VERY_COMFORTABLE', label: 'Very comfortable' },
  { value: 'SOMEWHAT_COMFORTABLE', label: 'Somewhat comfortable' },
  { value: 'NOT_VERY_COMFORTABLE', label: 'Not very comfortable' },
  { value: 'RATHER_NOT', label: "I'd rather not" },
]

export function NetworkComfortCheck() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          How comfortable do you feel letting your network know you&apos;re looking for a role?
        </p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          +5 pts, one time
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((opt) => (
          <form key={opt.value} action={setNetworkComfortLevel.bind(null, opt.value)}>
            <SubmitButton variant="outline" size="sm" className="w-full">
              {opt.label}
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
  )
}
