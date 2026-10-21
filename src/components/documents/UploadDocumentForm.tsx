'use client'

import { cn } from '@/lib/utils'
import { usePreservedFormAction } from '@/lib/forms/use-preserved-form'
import { uploadDocument } from '@/app/dashboard/documents/actions'

export function UploadDocumentForm({ requestId, title, hasFile }: { requestId: string; title: string; hasFile: boolean }) {
  const { state, pending, formRef, onSubmit } = usePreservedFormAction(uploadDocument, { resetOnSuccess: true })

  // The redesign: body-size text, the accepted types said once, and a quiet pill (the page's one orange action is the header's).
  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn('space-y-3', pending && 'cursor-progress')}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="block space-y-1">
        <span className="text-base font-semibold text-ink">{hasFile ? 'Replace the file' : 'Choose a file'}</span>
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
          aria-label={`File for ${title}`}
          className="block w-full text-base text-ink file:mr-3 file:rounded-full file:border file:border-border file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium"
        />
      </label>
      <p className="text-sm text-muted-foreground">PDF, Word, Excel, image, text or CSV, up to 10 MB.</p>
      <button type="submit" disabled={pending} className={cn('inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70', pending && 'cursor-progress')}>
        {pending ? 'Uploading…' : hasFile ? 'Replace document' : 'Upload document'}
      </button>
      {state?.message && (
        <p role="status" className="text-sm text-ink">
          {state.message}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-base text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
