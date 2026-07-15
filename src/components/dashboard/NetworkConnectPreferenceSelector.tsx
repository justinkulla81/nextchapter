'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { toggleNetworkConnectPreference } from '@/app/dashboard/network/actions'

const OPTIONS = [
  { value: 'in_person', label: 'In-person' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
]

export function NetworkConnectPreferenceSelector({ current }: { current: string[] }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-2', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <p className="text-sm font-medium text-foreground">
        How do you like to connect with your network?
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const selected = current.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => startTransition(() => toggleNetworkConnectPreference(opt.value))}
              className={cn(
                'rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors',
                selected
                  ? 'border-brand bg-brand/5 text-brand'
                  : 'border-border bg-white text-foreground hover:border-brand/40'
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
