'use client'

import { useActionState } from 'react'
import { setLinkedInUrl } from '@/app/dashboard/resume/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LinkedInUrlForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, formAction, pending] = useActionState(setLinkedInUrl, undefined)

  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor="linkedInUrl">Your LinkedIn URL</Label>
      <div className="flex gap-2">
        <Input
          id="linkedInUrl"
          name="linkedInUrl"
          type="url"
          placeholder="https://linkedin.com/in/you"
          defaultValue={currentUrl ?? ''}
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : currentUrl ? 'Update' : 'Save'}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
