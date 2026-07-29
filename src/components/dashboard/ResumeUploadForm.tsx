'use client'

import { useActionState } from 'react'
import { uploadResume } from '@/app/dashboard/resume/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { InlineLoadingState } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function ResumeUploadForm() {
  const [state, formAction, pending] = useActionState(uploadResume, undefined)

  if (state?.existingAccountFound) {
    return <ExistingAccountNotice needsPassword={false} />
  }

  if (state?.existingAccountNeedsPassword) {
    return <ExistingAccountNotice needsPassword email={state.existingAccountEmail} />
  }

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="file">Upload your resume (PDF or DOCX, up to 10MB)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx" required disabled={pending} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading and analyzing…' : 'Upload resume'}
      </Button>
      {pending && <InlineLoadingState label="This takes a few seconds — analyzing your resume…" />}
    </form>
  )
}
