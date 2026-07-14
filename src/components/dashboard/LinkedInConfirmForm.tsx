'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { confirmLinkedIn } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function LinkedInConfirmForm() {
  const [state, formAction, pending] = useActionState(confirmLinkedIn, undefined)
  const [noLinkedIn, setNoLinkedIn] = useState(false)

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <Input
        name="linkedInUrl"
        type="url"
        placeholder="https://linkedin.com/in/you"
        disabled={noLinkedIn}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="noLinkedIn"
          name="noLinkedIn"
          value="on"
          checked={noLinkedIn}
          onCheckedChange={(checked) => setNoLinkedIn(checked === true)}
        />
        <Label htmlFor="noLinkedIn" className="text-xs font-normal text-muted-foreground">
          I don&apos;t have one yet — I&apos;ll add it later
        </Label>
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
    </form>
  )
}
