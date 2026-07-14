'use client'

import { useActionState } from 'react'
import { confirmIndustry } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function IndustryConfirmForm({ industryContext }: { industryContext: string | null }) {
  const [state, formAction, pending] = useActionState(confirmIndustry, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <Input name="industryContext" placeholder="Industry" defaultValue={industryContext ?? ''} />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm'}
      </Button>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pre-filled from your resume — correct anything that&apos;s off.
      </Label>
    </form>
  )
}
