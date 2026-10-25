'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import { usePostHog } from '@/lib/posthog/client'
import { employerSectionForPath, type EmployerSectionKey } from '@/lib/employer/sections'
import { cookieOwnerForSection } from '@/lib/employer/section-links'

export interface SwitcherLinkItem {
  key: EmployerSectionKey
  label: string
  href: string
  /** Present when the sign-in bridge is available: a CSRF token bound to this person. */
  csrf?: string
}

function PendingButton({ className, children, pendingText }: { className: string; children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={cn(className, pending && 'cursor-wait opacity-80')}>
      {pending ? pendingText : children}
    </button>
  )
}

/**
 * One way into a section. A plain link when the section shares the page's sign-in; otherwise a button that posts to the
 * sign-in bridge (/api/employer/section-switch), which signs the person in to that section with their own email.
 * Without a CSRF token (bridge unavailable) it is always a plain link, which is today's behavior.
 */
export function SectionEntry({ item, bridge, className, label, onClick }: { item: SwitcherLinkItem; bridge: boolean; className: string; label?: string; onClick?: () => void }) {
  const text = label ?? item.label
  if (bridge && item.csrf) {
    return (
      <form method="post" action="/api/employer/section-switch" onSubmit={onClick} className="contents">
        <input type="hidden" name="to" value={item.key} />
        <input type="hidden" name="csrf" value={item.csrf} />
        <PendingButton className={className} pendingText="Opening…">
          {text}
        </PendingButton>
      </form>
    )
  }
  return (
    <a href={item.href} onClick={onClick} className={className}>
      {text}
    </a>
  )
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
        const differentSignIn = !current || cookieOwnerForSection(item.key) !== cookieOwnerForSection(current)
        return (
          <SectionEntry
            key={item.key}
            item={item}
            bridge={differentSignIn}
            className={cls}
            onClick={() => posthog?.capture('employer_section_switch_clicked', { from: current ?? null, to: item.key, viaBridge: differentSignIn && !!item.csrf })}
          />
        )
      })}
    </nav>
  )
}
