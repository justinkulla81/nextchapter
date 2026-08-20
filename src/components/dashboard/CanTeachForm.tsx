'use client'

import { useActionState } from 'react'
import { updateCanTeach } from '@/app/dashboard/actions'
import { TagInput } from '@/components/onboarding/TagInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function CanTeachForm({ canTeach }: { canTeach: string[] }) {
  const [state, formAction, pending] = useActionState(updateCanTeach, undefined)

  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <TagInput
        name="canTeach"
        defaultValue={canTeach}
        placeholder="e.g. Interview prep for PM roles, negotiating comp, breaking into fintech"
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      <Label className="block text-xs font-normal text-muted-foreground">
        Shown on your Contacts profile — what could you help another NextChapter member with.
      </Label>
    </form>
  )
}
