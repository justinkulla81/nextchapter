'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { declareConflictAction } from '@/app/hiring/(app)/candidates/[submissionId]/actions'

// §A8's conflict rule — a hiring manager can declare a relationship or
// household conflict themselves (the two conflict types that can't be
// auto-detected from data on file). Submitting this immediately hides the
// candidate from this hiring manager's view — see declareConflictAction's
// redirect.
export function ConflictDeclareForm({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false)
  const action = declareConflictAction.bind(null, submissionId)

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Declare a conflict of interest
      </Button>
    )
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">Declare a conflict of interest</p>
      <p className="text-xs text-muted-foreground">
        This immediately removes this candidate from your view. Use this if you have a personal
        relationship with them or they&apos;re part of your household.
      </p>
      <div className="flex gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground">
          <input type="radio" name="source" value="DECLARED_RELATIONSHIP" defaultChecked className="sr-only" />
          Personal relationship
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground">
          <input type="radio" name="source" value="DECLARED_HOUSEHOLD" className="sr-only" />
          Same household
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground">
          <input type="radio" name="source" value="DECLARED_OTHER" className="sr-only" />
          Other
        </label>
      </div>
      <div className="space-y-1">
        <Label htmlFor="conflict-note">Note (optional)</Label>
        <Input id="conflict-note" name="note" />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="destructive" size="sm">
          Confirm — remove from my view
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
