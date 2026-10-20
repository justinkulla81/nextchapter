import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// A sentence the member should read, in the page's own voice. Replaces the boxed, tinted notices on the old pages.
// "problem" is announced to screen readers straight away; the others are polite.
export function Callout({ tone = 'info', children, className }: { tone?: 'info' | 'problem'; children: ReactNode; className?: string }) {
  return (
    <p role={tone === 'problem' ? 'alert' : 'status'} className={cn('rounded-2xl p-5 text-base', tone === 'problem' ? 'bg-destructive/5 text-destructive' : 'bg-muted/60 text-ink', className)}>
      {children}
    </p>
  )
}
