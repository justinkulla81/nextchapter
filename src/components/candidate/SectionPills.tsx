import Link from 'next/link'
import { cn } from '@/lib/utils'

// The parts of one place's page, one shown at a time. Plain links, so each part is
// its own address and the page stays short.
export function SectionPills({ items, current, label }: { items: { key: string; label: string; href: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === current ? 'page' : undefined}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium',
            i.key === current ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
