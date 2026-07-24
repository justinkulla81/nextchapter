'use client'

import { useActionState, useRef } from 'react'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { SubmitButton } from '@/components/ui/submit-button'

export type AvatarUploadState = { error?: string } | undefined

// Reusable across all 4 portals (candidate, coach, recruiter, employer) —
// each portal's settings page passes its own server actions bound to the
// right profile table.
export function AvatarUploadForm({
  displayName,
  currentUrl,
  visible,
  uploadAction,
  removeAction,
  toggleVisibilityAction,
}: {
  displayName: string
  currentUrl: string | null
  visible: boolean
  uploadAction: (prevState: AvatarUploadState, formData: FormData) => Promise<AvatarUploadState>
  removeAction: () => Promise<void>
  toggleVisibilityAction: (currentlyVisible: boolean) => Promise<void>
}) {
  const [state, formAction, isPending] = useActionState(uploadAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AvatarDisplay name={displayName} url={currentUrl} size={56} />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <form
            ref={formRef}
            action={formAction}
            className={isPending ? 'cursor-wait' : undefined}
          >
            <label className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">
              {isPending ? 'Uploading…' : currentUrl ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={isPending}
                onChange={() => formRef.current?.requestSubmit()}
              />
            </label>
          </form>

          {currentUrl && (
            <form action={removeAction}>
              <SubmitButton variant="ghost" size="sm">
                Remove
              </SubmitButton>
            </form>
          )}
        </div>

        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

        {currentUrl && (
          <form action={toggleVisibilityAction.bind(null, visible)}>
            <SubmitButton variant="outline" size="sm">
              {visible ? 'Visible to others' : 'Hidden from others'}
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
