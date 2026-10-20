import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui/spinner'

// The empty, loading and error states for the parts of Find a job (not posted yet, independent work, resources). One
// pattern so each part does not write its own.

export function FindPartMessage({ title, children, action, tone = 'empty' }: { title: string; children?: ReactNode; action?: ReactNode; tone?: 'empty' | 'error' }) {
  return (
    <section role={tone === 'error' ? 'alert' : undefined} className="space-y-3 rounded-2xl border border-border bg-muted/40 p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {children && <div className="max-w-xl space-y-2 text-base text-muted-foreground">{children}</div>}
      {action}
    </section>
  )
}

export function FindPartLoading({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-2xl border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      {label}
    </p>
  )
}
