'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePostHog } from '@/lib/posthog/client'
import { employerSectionForPath, type EmployerSectionKey } from '@/lib/employer/sections'

export interface SwitcherLinkItem {
  key: EmployerSectionKey
  label: string
  href: string
}

// The sections this person holds, as adjacent buttons (two or three options, so no dropdown). Only sections they hold are
// ever passed in. Renders nothing for someone who holds one section: there is nothing to switch to.
export function SectionSwitcher({ items, className, onDark = true }: { items: SwitcherLinkItem[]; className?: string; onDark?: boolean }) {
  const pathname = usePathname()
  const posthog = usePostHog()
  if (items.length < 2) return null
  const current = employerSectionForPath(pathname)?.key
  return (
    <nav aria-label="Your employer sections" className={cn('flex items-center gap-1', className)}>
      {items.map((item) => {
        const isCurrent = item.key === current
        const cls = cn(
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          onDark
            ? isCurrent
              ? 'bg-white text-[#0b2545]'
              : 'border border-white/40 text-white hover:bg-white/15'
            : isCurrent
              ? 'bg-foreground text-background'
              : 'border border-border hover:bg-muted'
        )
        if (isCurrent) {
          return (
            <span key={item.key} aria-current="page" className={cls}>
              {item.label}
            </span>
          )
        }
        return (
          <a key={item.key} href={item.href} onClick={() => posthog?.capture('employer_section_switch_clicked', { from: current ?? null, to: item.key })} className={cls}>
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}
