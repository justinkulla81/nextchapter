'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

export function SampleReportPreview() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand underline underline-offset-4"
      >
        See a sample report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-h-full max-w-4xl overflow-auto rounded-xl bg-white p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close preview"
              className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-foreground shadow"
            >
              <X className="size-4" />
            </button>
            <Image
              src="/marketing/success-dashboard.png"
              alt="NextChapter Success Dashboard showing grades trending upward, with an action plan"
              width={2404}
              height={1762}
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  )
}
