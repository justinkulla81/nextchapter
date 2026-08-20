'use client'

import { useState } from 'react'
import { ResumePreviewModal } from '@/components/dashboard/ResumePreviewModal'

export function ResumeViewButton({
  signedUrl,
  title = 'Resume',
  className,
  children = 'View',
}: {
  signedUrl: string
  title?: string
  className?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ResumePreviewModal open={open} onOpenChange={setOpen} signedUrl={signedUrl} title={title} />
    </>
  )
}
