'use client'

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
}

// The left role rail (spec §4). Renders only what the server resolved this
// person holds; it is navigation, not protection (requireWorkspace is).
export function WorkspaceRail({ items }: { items: RailItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Workspaces" className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:px-3 lg:py-4">
      {items.map((item) => {
        const Icon = ICONS[item.icon]
        if (item.badge) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/70"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{item.badge}</span>
            </span>
          )
        }
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
