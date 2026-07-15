'use client'

import { useActionState } from 'react'
import { addLearningBadge } from '@/app/dashboard/learning/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const BADGE_TYPE_OPTIONS = [
  { value: 'course_completed', label: 'Course completed' },
  { value: 'certification', label: 'Certification' },
  { value: 'ai_project', label: 'AI project' },
  { value: 'conference_talk', label: 'Conference talk' },
  { value: 'published', label: 'Published' },
]

export function LearningBadgeForm() {
  const [state, formAction, pending] = useActionState(addLearningBadge, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="lb-title">What did you complete?</Label>
        <Input id="lb-title" name="title" placeholder="e.g. AWS Cloud Practitioner" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lb-type">Type</Label>
          <Select name="badgeType" defaultValue="course_completed">
            <SelectTrigger id="lb-type" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  BADGE_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BADGE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lb-completedAt">Completed on</Label>
          <Input id="lb-completedAt" name="completedAt" type="date" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lb-provider">Provider (optional)</Label>
        <Input id="lb-provider" name="provider" placeholder="e.g. Coursera, AWS" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lb-url">Link to verify (optional)</Label>
        <Input id="lb-url" name="verificationUrl" type="url" placeholder="Certificate or badge URL" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Saving…' : 'Log this'}
      </Button>
    </form>
  )
}
