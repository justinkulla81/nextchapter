import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Signature } from '@/components/ui/signature'

/** A personal note on warm paper, signed by Victoria. For the one note on a page, never for ordinary cards. */
export function PaperNote({ label, children, name, className }: { label?: string; children: ReactNode; name?: 'Victoria' | 'Vicki' | 'Vic'; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-paper-edge bg-paper px-5 py-4', className)}>
      {label && <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</p>}
      <div className="mt-1 text-base leading-relaxed text-ink">{children}</div>
      <Signature name={name} className="mt-3" />
    </div>
  )
}
