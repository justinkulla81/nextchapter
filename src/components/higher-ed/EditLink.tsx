import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

// A small pencil next to something the organization owns, going to where it is edited (owner, 2026-11-17). On a read-only
// seat (a demo, a viewer) it stays visible, greyed, and says why, so a viewer can see the thing is editable.
export function EditLink({ href, what, readOnly, className, onDark = false }: { href: string; what: string; readOnly: boolean; className?: string; onDark?: boolean }) {
  const base = cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', onDark ? 'bg-black/45 text-white/90' : 'text-muted-foreground', className)
  if (readOnly) {
    return (
      <span className={cn(base, 'opacity-80')}>
        <Pencil className="size-3" aria-hidden="true" />
        {['Edit', what].filter(Boolean).join(' ')} · off in read-only view
      </span>
    )
  }
  return (
    <Link href={href} className={cn(base, onDark ? 'hover:bg-black/60' : 'hover:text-foreground hover:underline')}>
      <Pencil className="size-3" aria-hidden="true" />
      {['Edit', what].filter(Boolean).join(' ')}
    </Link>
  )
}
