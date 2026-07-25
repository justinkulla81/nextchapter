'use client'

import { useActionState } from 'react'
import { updateResumeKeywords } from '@/app/dashboard/actions'
import { TagInput } from '@/components/onboarding/TagInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function ResumeKeywordsForm({ resumeKeywords }: { resumeKeywords: string[] }) {
  const [state, formAction, pending] = useActionState(updateResumeKeywords, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <TagInput
        name="resumeKeywords"
        defaultValue={resumeKeywords}
        placeholder="e.g. Salesforce, P&L management, Python"
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      <Label className="block text-xs font-normal text-muted-foreground">
        Pulled automatically from your resume — we use these to find better-matched jobs. Add,
        remove, or correct anything.
      </Label>
    </form>
  )
}
