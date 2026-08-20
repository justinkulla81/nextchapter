'use client'

import { X, ExternalLink } from 'lucide-react'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'

// Same on-demand-iframe pattern as VideoPlayerModal.tsx — mounted only
// while open. Portrait-shaped for a document instead of 16:9 video.
// Supabase's default createSignedUrl (no `download` option, see
// resume/page.tsx) serves the PDF inline rather than forcing a download,
// so it renders directly in the iframe. "Open in new tab" stays as a
// fallback for anything a browser's built-in PDF viewer handles better
// full-screen (annotations, printing) than the embedded frame does.
export function ResumePreviewModal({
  open,
  onOpenChange,
  signedUrl,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  signedUrl: string
  title: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[90vh] w-[min(92vw,56rem)] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-2">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary underline underline-offset-4"
            >
              Open in new tab <ExternalLink className="size-3" />
            </a>
            <DialogClose className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-off-white">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-b-lg bg-muted">
          {open && <iframe key={signedUrl} src={signedUrl} title={title} className="size-full" />}
        </div>
      </DialogPopup>
    </Dialog>
  )
}
