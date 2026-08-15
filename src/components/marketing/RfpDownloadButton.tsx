'use client'

import { usePostHog } from 'posthog-js/react'
import { Download, Printer } from 'lucide-react'

// The two real interactive elements on /rfp-template — each fires before
// the browser navigates away or opens the print dialog, per CLAUDE.md's
// instruction to wire PostHog into every user-initiated action at build
// time.
export function RfpDownloadButton() {
  const posthog = usePostHog()

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <a
        href="/api/rfp-template/download"
        onClick={() => posthog?.capture('rfp_template_downloaded', { format: 'pdf' })}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-success px-6 py-3 text-sm font-medium text-white hover:bg-success-hover"
      >
        <Download className="size-4" />
        Download the PDF
      </a>
      <button
        type="button"
        onClick={() => {
          posthog?.capture('rfp_template_downloaded', { format: 'print' })
          window.print()
        }}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground hover:border-brand hover:text-brand"
      >
        <Printer className="size-4" />
        Print this page
      </button>
    </div>
  )
}
