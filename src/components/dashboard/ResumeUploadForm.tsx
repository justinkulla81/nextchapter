'use client'

import { useActionState, useState } from 'react'
import { uploadResume } from '@/app/dashboard/resume/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { InlineLoadingState } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function ResumeUploadForm() {
  const [state, formAction, pending] = useActionState(uploadResume, undefined)
  const [hasFile, setHasFile] = useState(false)

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
        {/* The "Choose File" pseudo-button (the input's ::file-selector-button)
            starts green — the one thing to do — and turns gray once a file is
            picked, handing the "next action" spotlight to the Upload button
            below instead. */}
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx"
          required
          disabled={pending}
          onChange={(e) => setHasFile(e.target.files !== null && e.target.files.length > 0)}
          className={cn(
            !hasFile && 'file:bg-success file:text-white hover:file:bg-success-hover',
            pending && 'file:cursor-progress'
          )}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || !hasFile} variant={hasFile ? 'success' : 'secondary'}>
        {pending ? 'Uploading and analyzing…' : 'Upload resume'}
      </Button>
      {pending && <InlineLoadingState label="This takes a few seconds — analyzing your resume…" />}
    </form>
  )
}
