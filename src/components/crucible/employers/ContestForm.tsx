'use client'

import { useActionState } from 'react'
import { createCrucibleContest } from '@/app/crucible/employers/(app)/contests/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'

const TARGET_FUNCTION_OPTIONS = [
  { value: 'ALL', label: 'All candidates, any function' },
  { value: 'TECH', label: 'Tech / Engineering' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'DATA', label: 'Data / Analytics' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'BUSINESS', label: 'Business / Operations' },
] as const

export function ContestForm() {
  const [state, formAction] = useActionState(createCrucibleContest, undefined)

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Contest title</Label>
        <Input id="title" name="title" required placeholder="Redo our pricing page" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="businessProblem">The business problem</Label>
        <Textarea
          id="businessProblem"
          name="businessProblem"
          required
          rows={6}
          placeholder="Describe a real problem candidates can meaningfully respond to with only what you give them here — e.g. redo our website, find the insight in this dataset, rethink how we handle X."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="referenceFile">Reference file (optional)</Label>
        <Input id="referenceFile" name="referenceFile" type="file" accept=".pdf,.docx,.csv,.xlsx,.txt" />
        <p className="text-xs text-muted-foreground">
          A dataset, screenshot, or doc candidates can use — shown to anyone invited to this contest.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetFunction">Who should see this?</Label>
        <Select name="targetFunction" defaultValue="ALL">
          <SelectTrigger id="targetFunction" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) => TARGET_FUNCTION_OPTIONS.find((o) => o.value === value)?.label ?? 'Select one'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TARGET_FUNCTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full">Save as draft</SubmitButton>
    </form>
  )
}
