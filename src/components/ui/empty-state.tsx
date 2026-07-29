import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Prompt 66 — one reusable empty-state pattern (icon + short encouraging
// copy + clear CTA) for wherever a candidate can hit a genuinely empty list
// early in their journey. cta is optional since some empty states (e.g. "0
// actions completed yet this week") don't need a separate CTA beyond the
// surrounding page's own actions.
export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  cta?: { label: string; href: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center',
        className
      )}
    >
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {cta && (
        <Button nativeButton={false} render={<Link href={cta.href} />} size="sm" className="mt-2">
          {cta.label}
        </Button>
      )}
    </div>
  )
}
