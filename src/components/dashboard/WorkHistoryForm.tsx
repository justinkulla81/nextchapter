'use client'

import { useActionState, useState } from 'react'
import { addWorkHistoryEntry } from '@/app/dashboard/resume/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ENGAGEMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'FRACTIONAL', label: 'Fractional' },
  { value: 'INTERIM', label: 'Interim' },
  { value: 'CONSULTING', label: 'Consulting' },
]

export function WorkHistoryForm() {
  const [state, formAction, pending] = useActionState(addWorkHistoryEntry, undefined)
  const [isCurrent, setIsCurrent] = useState(true)

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wh-company">Company</Label>
          <Input id="wh-company" name="companyName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wh-role">Role title</Label>
          <Input id="wh-role" name="roleTitle" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wh-engagement">Engagement type</Label>
        <Select name="engagementType" defaultValue="FULL_TIME">
          <SelectTrigger id="wh-engagement" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                ENGAGEMENT_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ENGAGEMENT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wh-start">Start date</Label>
          <Input id="wh-start" name="startDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wh-end">End date</Label>
          <Input id="wh-end" name="endDate" type="date" disabled={isCurrent} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="wh-current"
          name="isCurrent"
          checked={isCurrent}
          onCheckedChange={(checked) => setIsCurrent(checked === true)}
        />
        <Label htmlFor="wh-current" className="font-normal">
          This is my current role
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wh-achievement">Key achievement (optional)</Label>
        <Input id="wh-achievement" name="keyAchievement" placeholder="e.g. Grew pipeline 3x in 18 months" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.victoriaNudge && (
        <div className="rounded-md border border-border bg-off-white p-3 text-sm">
          <p className="font-medium text-foreground">Victoria</p>
          <p className="mt-1 text-muted-foreground">{state.victoriaNudge}</p>
        </div>
      )}

      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Saving…' : 'Add to work history'}
      </Button>
    </form>
  )
}
