'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { postAlumniJob } from '@/app/institution/(app)/jobs/actions'

export function AlumniJobForm() {
  const [state, action] = useActionState(postAlumniJob, undefined)
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="title">Job title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="companyName">Company</Label>
        <Input id="companyName" name="companyName" required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="url">Link to the posting</Label>
        <Input id="url" name="url" type="url" required placeholder="https://" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="salaryMin">Salary min</Label>
          <Input id="salaryMin" name="salaryMin" type="number" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="salaryMax">Salary max</Label>
          <Input id="salaryMax" name="salaryMax" type="number" />
        </div>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="description">Notes for alumni (optional)</Label>
        <textarea id="description" name="description" rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      </div>
      {state?.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      {state?.ok && (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Submitted. A NextChapter admin reviews it, then it shows to your alumni.
        </p>
      )}
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Submitting…">Post for alumni</SubmitButton>
      </div>
    </form>
  )
}
