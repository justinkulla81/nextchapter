'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Building2, Compass, GraduationCap, HandCoins, Landmark, MapPin, MessagesSquare, Presentation, Settings, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceConfig } from '@/lib/higher-ed/workspaces'

const ICONS: Record<WorkspaceConfig['icon'], LucideIcon> = {
  GraduationCap,
  Users,
  HandCoins,
  Compass,
  Building2,
  Settings,
  BookOpen,
  Presentation,
  Landmark,
  MapPin,
  MessagesSquare,
}

export type RailItem = {
  key: string
  label: string
  icon: WorkspaceConfig['icon']
  href: string
  // V2 entries ("Coming", demo tenants only) and workspaces the license tier
  // doesn't include ("Institution tier", shown to admins only) are greyed out.
  badge: string | null
  // A small heading shown above this item (the first of a group).
  section?: string
  // Areas of a workspace and their pages (Talent Hub), shown under the item while it is open. The open area lists its pages.
  children?: { label: string; pages: { label: string; href: string }[] }[]
}

// The left role rail (spec §4). Renders only what the server resolved this
// person holds; it is navigation, not protection (requireWorkspace is).
export function WorkspaceRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Workspaces" className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        const heading = item.section ? <p className="mt-3 hidden px-3 text-xs font-medium text-muted-foreground lg:block">{item.section}</p> : null
        if (item.badge) {
          return (
            <Fragment key={item.key}>
              {heading}
              <span aria-disabled="true" className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/70">
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{item.badge}</span>
              </span>
            </Fragment>
          )
        }
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Fragment key={item.key}>
            {heading}
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--portal-tint,var(--muted))] font-semibold text-[color:var(--portal,var(--ink))] shadow-[inset_3px_0_0_var(--portal,var(--ink))]'
                  : 'text-ink/80 hover:bg-muted',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
            {active && item.children && item.children.length > 0 && (
              <ul className="mt-1 mb-2 ml-5 hidden space-y-0.5 border-l border-border pl-2 lg:block">
                {item.children.map((area) => {
                  const pageActive = (href: string) => pathname === href
                  const areaActive = area.pages.some((p) => pageActive(p.href))
                  return (
                    <li key={area.label}>
                      <Link
                        href={area.pages[0].href}
                        aria-current={areaActive && area.pages.length === 1 ? 'page' : undefined}
                        className={cn('block rounded-md px-2 py-1.5 text-sm', areaActive ? 'font-semibold text-ink' : 'text-muted-foreground hover:text-ink')}
                      >
                        {area.label}
                      </Link>
                      {areaActive && area.pages.length > 1 && (
                        <ul className="mt-0.5 mb-1 ml-2 space-y-0.5">
                          {area.pages.map((p) => (
                            <li key={p.href}>
                              <Link
                                href={p.href}
                                aria-current={pageActive(p.href) ? 'page' : undefined}
                                className={cn('block rounded-md px-2 py-1 text-[13px]', pageActive(p.href) ? 'bg-[var(--portal-tint,var(--muted))] font-medium text-ink' : 'text-muted-foreground hover:text-ink')}
                              >
                                {p.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
