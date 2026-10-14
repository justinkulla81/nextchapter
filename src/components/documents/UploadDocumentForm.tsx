'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { uploadDocument } from '@/app/dashboard/documents/actions'

export function UploadDocumentForm({ requestId, title, hasFile }: { requestId: string; title: string; hasFile: boolean }) {
  const [state, action] = useActionState(uploadDocument, undefined)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">{hasFile ? 'Replace the file' : 'Choose a file'}</span>
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
          aria-label={`File for ${title}`}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
      </label>
      <p className="text-xs text-muted-foreground">PDF, Word, Excel, image, text or CSV, up to 10 MB.</p>
      <SubmitButton size="sm" pendingLabel="Uploading…" savedLabel={hasFile ? 'Replace document' : 'Upload document'}>
        {hasFile ? 'Replace document' : 'Upload document'}
      </SubmitButton>
      {state?.message && (
        <p role="status" className="text-xs text-muted-foreground">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
