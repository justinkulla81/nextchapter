'use client'

import { useActionState, useRef } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import type { AvatarUploadState } from '@/components/ui/avatar-upload-form'

// Banner photo for the candidate page. Choosing a file uploads it straight away.
export function HeroUploadForm({
  currentUrl,
  uploadAction,
  removeAction,
}: {
  currentUrl: string | null
  uploadAction: (prev: AvatarUploadState, fd: FormData) => Promise<AvatarUploadState>
  removeAction: () => Promise<void>
}) {
  const [state, action, pending] = useActionState(uploadAction, undefined)
  const ref = useRef<HTMLFormElement>(null)
  return (
    <div className="space-y-2">
      <div
        className="h-24 w-44 rounded-md border border-border bg-muted bg-cover bg-center"
        style={currentUrl ? { backgroundImage: `url(${currentUrl})` } : undefined}
        aria-label={currentUrl ? 'Current banner photo' : 'No banner photo yet'}
      />
      <div className="flex items-center gap-3">
        <form ref={ref} action={action} className={pending ? 'cursor-wait' : undefined}>
          <label className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">
            {pending ? 'Uploading…' : currentUrl ? 'Change photo' : 'Upload a photo'}
            <input type="file" name="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={pending} onChange={() => ref.current?.requestSubmit()} />
          </label>
        </form>
        {currentUrl && (
          <form action={removeAction}>
            <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">Remove</SubmitButton>
          </form>
        )}
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <p className="text-xs text-muted-foreground">A wide photo works best. PNG, JPEG or WebP, up to 5 MB.</p>
    </div>
  )
}
