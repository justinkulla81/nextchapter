'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeTab, lockReasonFor, placeForPath, visibleTabs, type NavLocks } from '@/lib/nav/places'

// The tab row every page in a place shows, so moving around inside a place
// never needs the main menu. Renders nothing outside the six places.
export function PlaceTabs({ employed, locks }: { employed: boolean; locks: NavLocks }) {
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
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px block border-b-2 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'border-brand text-brand' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
