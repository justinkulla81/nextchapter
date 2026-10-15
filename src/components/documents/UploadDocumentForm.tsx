'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePreservedFormAction } from '@/lib/forms/use-preserved-form'
import { uploadDocument } from '@/app/dashboard/documents/actions'

export function UploadDocumentForm({ requestId, title, hasFile }: { requestId: string; title: string; hasFile: boolean }) {
  const { state, pending, formRef, onSubmit } = usePreservedFormAction(uploadDocument, { resetOnSuccess: true })
  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn('space-y-2', pending && 'cursor-progress')}>
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
      <Button type="submit" size="sm" disabled={pending} className={cn(pending && 'cursor-progress')}>
        {pending ? 'Uploading…' : hasFile ? 'Replace document' : 'Upload document'}
      </Button>
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
