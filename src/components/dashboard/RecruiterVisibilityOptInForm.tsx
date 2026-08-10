'use client'

import { useState, useTransition } from 'react'
import { setRecruiterDatabaseOptIn } from '@/app/dashboard/privacy/actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'yes', label: 'Yes, list me for recruiters' },
  { value: 'no', label: "No, don't list me" },
] as const

const LABELS: Record<string, string> = Object.fromEntries(OPTIONS.map((opt) => [opt.value, opt.label]))

export function RecruiterVisibilityOptInForm({ optedIn }: { optedIn: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<'yes' | 'no'>(optedIn ? 'yes' : 'no')

  const handleChange = (next: string | null) => {
    const optedInNext = next === 'yes'
    setValue(optedInNext ? 'yes' : 'no')
    startTransition(async () => {
      await setRecruiterDatabaseOptIn(optedInNext)
    })
  }

  return (
    <div className={cn('flex items-center gap-2', isPending && 'cursor-progress [&_*]:cursor-progress')}>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue>{(v: string | null) => (v ? LABELS[v] : undefined)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
    </div>
  )
}
