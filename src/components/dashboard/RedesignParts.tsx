'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusUnlockBox } from '@/components/dashboard/StatusUnlockBox'
import { activeTab, lockReasonFor, resolveTabHref, statusLockedTabs, visibleTabs, groupsOf, type NavLocks, type PaidAccess } from '@/lib/nav/places'
import { redesignPlaceForPath, redesignPlacesFor } from '@/lib/nav/redesign-places'

// The small switches at the top of a page, for the parts of one menu entry (Jobs, Not posted yet, ...).
// A breadcrumb says where you are. Renders nothing when the entry has a single page.
export function RedesignParts({ employed, earlyCareer, locks, paidAccess, moneyHelp }: { employed: boolean; earlyCareer: boolean; locks: NavLocks; paidAccess: PaidAccess; moneyHelp: boolean | null }) {
  const pathname = usePathname()
  const places = redesignPlacesFor({ moneyHelp })
  const place = redesignPlaceForPath(pathname, places)
  if (!place) return null
  const current = activeTab(place, pathname)
  const group = groupsOf(place).find((g) => current && g.hrefs.includes(current.href))
  const tabs = visibleTabs(place, { employed, earlyCareer, mode: locks.mode }).filter((t) => group?.hrefs.includes(t.href))
  const statusLocked = locks.mode ? statusLockedTabs(place, { employed, earlyCareer, mode: locks.mode }) : []
  const showParts = tabs.length > 1
  if (!showParts && statusLocked.length === 0) return null

  return (
    <div className="mb-6 space-y-3">
      {showParts && (
        <nav aria-label={`${group?.label} parts`} className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const reason = lockReasonFor(tab.href, locks, tab)
            const active = current?.href === tab.href
            if (reason) {
              return (
                <span key={tab.href} aria-disabled="true" title={reason} className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground/60">
                  {tab.label}
                  <Lock className="size-3 text-orange" aria-hidden />
                  <span className="sr-only">{reason}</span>
                </span>
              )
            }
            return (
              <Link
                key={tab.href}
                href={resolveTabHref(tab, paidAccess)}
                aria-current={active ? 'page' : undefined}
                className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', active ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      )}
      {locks.mode && statusLocked.length > 0 && <StatusUnlockBox mode={locks.mode} lockedTools={statusLocked} />}
    </div>
  )
}
