'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeTab, lockReasonFor, placeForPath, resolveTabHref, visibleTabs, type NavLocks, type PaidAccess } from '@/lib/nav/places'

// The tab row every page in a place shows, so moving around inside a place
// never needs the main menu. Renders nothing outside the six places.
export function PlaceTabs({
  employed,
  locks,
  paidAccess,
  tabBadges = {},
}: {
  employed: boolean
  locks: NavLocks
  paidAccess: PaidAccess
  /** Live counts by tab href: something new for the member on that tab. */
  tabBadges?: Record<string, number>
}) {
  const pathname = usePathname()
  const place = placeForPath(pathname)
  if (!place) return null
  const tabs = visibleTabs(place, { employed })
  if (tabs.length < 2) return null
  const current = activeTab(place, pathname)

  return (
    <nav aria-label={`${place.label} sections`} className="mb-6 -mx-1 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-5 px-1">
        {tabs.map((tab) => {
          const reason = lockReasonFor(tab.href, locks)
          const active = current?.href === tab.href
          if (reason) {
            return (
              <li key={tab.href}>
                <span
                  aria-disabled="true"
                  title={reason}
                  className="-mb-px flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent py-2 text-sm font-medium text-muted-foreground/60"
                >
                  {tab.label}
                  <Lock className="size-3 text-orange" aria-hidden />
                  <span className="sr-only">{reason}</span>
                </span>
              </li>
            )
          }
          return (
            <li key={tab.href}>
              <Link
                href={resolveTabHref(tab, paidAccess)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px block border-b-2 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tabBadges[tab.href] ? (
                  <span className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                    <span className="sr-only">New: </span>
                    {tabBadges[tab.href]}
                  </span>
                ) : null}
                {tab.paid && !paidAccess[tab.paid] && (
                  <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-success uppercase">Premium</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
