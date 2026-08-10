'use client'

import { useState, useTransition } from 'react'
import { updateResumeBookOptIn } from '@/app/dashboard/find-my-job/actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'yes', label: 'Yes, include my resume' },
  { value: 'no', label: "No, don't include me" },
] as const

export function ResumeBookOptInForm({ optedIn }: { optedIn: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<'yes' | 'no'>(optedIn ? 'yes' : 'no')

  const handleChange = (next: string | null) => {
    const optedInNext = next === 'yes'
    setValue(optedInNext ? 'yes' : 'no')
    startTransition(async () => {
      await updateResumeBookOptIn(optedInNext)
    })
  }

  return (
    <div className={cn('flex items-center gap-2', isPending && 'cursor-progress [&_*]:cursor-progress')}>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue />
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
