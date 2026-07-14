'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { uploadResume } from '@/app/dashboard/resume/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function ResumeUploadForm() {
  const [state, formAction, pending] = useActionState(uploadResume, undefined)

  if (state?.existingAccountFound) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          Looks like you already have an account with this email — log in instead of starting a
          new one.
        </p>
        <Link
          href="/auth/login"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Log in
        </Link>
      </div>
    )
  }

  if (state?.existingAccountNeedsPassword) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          You&apos;ve already started with this email, but never finished setting a password —
          let&apos;s get that done so you can log back in, instead of starting over.
        </p>
        <Link
          href={`/auth/forgot-password?email=${encodeURIComponent(state.existingAccountEmail ?? '')}`}
          className="inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Set my password
        </Link>
      </div>
    )
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
    </form>
  )
}
