'use client'

import type { ReactNode } from 'react'
import { posthog } from '@/lib/posthog/client'

// A plain link to a file (CSV, JSON, PDF, image) that records the click. Not next/link: a file is a download, not a page.
export function PressDownload({ href, id, children, className }: { href: string; id: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={className ?? 'text-brand underline underline-offset-4'}
      onClick={() => posthog.capture('press_download_clicked', { id, href })}
    >
      {children}
    </a>
  )
}
