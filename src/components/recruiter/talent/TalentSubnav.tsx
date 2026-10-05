import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/recruiters/talent', label: 'Candidates' },
  { href: '/recruiters/talent/replies', label: 'Replies' },
  { href: '/recruiters/talent/searches', label: 'Open searches' },
  { href: '/recruiters/talent/setup', label: 'Setup' },
] as const

export function TalentSubnav({ active, draftCount = 0 }: { active: (typeof TABS)[number]['href']; draftCount?: number }) {
  return (
    <nav aria-label="NextChapter Talent" className="flex flex-wrap gap-2 border-b border-border pb-3">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab.href === active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {tab.label}
          {tab.href === '/recruiters/talent/replies' && draftCount > 0 && (
            <span className="ml-1.5 rounded-full bg-orange/20 px-1.5 py-0.5 text-xs font-semibold text-orange">{draftCount}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}

export function TagBadge({ tag }: { tag: 'FIT' | 'NICHE' | 'OUTSIDE' | null }) {
  const label = tag === 'FIT' ? 'Fit' : tag === 'NICHE' ? 'In your niche' : tag === 'OUTSIDE' ? 'Outside focus' : 'Reading resume'
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        tag === 'FIT' && 'bg-success/15 text-success',
        tag === 'NICHE' && 'bg-primary/10 text-primary',
        tag === 'OUTSIDE' && 'bg-muted text-muted-foreground',
        !tag && 'bg-muted text-muted-foreground italic'
      )}
    >
      {label}
    </span>
  )
}
