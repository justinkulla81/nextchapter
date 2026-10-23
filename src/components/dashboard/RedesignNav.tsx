'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { BookOpen, Briefcase, ChevronsLeft, ChevronsRight, Home, LifeBuoy, Lock, Menu, UserCog, Users, Wallet, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/dashboard/actions'
import { setSeniorJobsRestored } from '@/app/dashboard/senior-actions'
import { posthog } from '@/lib/posthog/client'
import type { SeniorOverlay } from '@/lib/journey/menu'
import { menuEntries, type NavLocks, type PaidAccess } from '@/lib/nav/places'
import { redesignPlaceForPath, redesignPlacesFor, type RedesignKey } from '@/lib/nav/redesign-places'
import { SignOutForm } from '@/components/auth/SignOutForm'

const ICONS: Record<RedesignKey, LucideIcon> = { home: Home, jobs: Briefcase, network: Users, learn: BookOpen, money: Wallet, account: UserCog, help: LifeBuoy }
const PHONE_TABS: RedesignKey[] = ['home', 'jobs', 'network', 'learn']
const STORAGE_KEY = 'nc-menu-collapsed'

export interface RedesignNavProps {
  badges?: Partial<Record<RedesignKey, number>>
  employed: boolean
  earlyCareer: boolean
  locks: NavLocks
  paidAccess: PaidAccess
  moneyHelp: boolean | null
  /** Senior overlay (src/lib/journey/menu.ts): reorders and mutes, never removes. */
  senior?: SeniorOverlay
  seniorSource?: 'detected' | 'switch'
}

// The job board, muted for senior leaders: still a link, and one click puts it back to full strength.
function RestoreJobs() {
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} aria-busy={pending} onClick={() => start(async () => { await setSeniorJobsRestored(true) })} className={cn('px-2 pb-1 text-xs font-medium text-brand underline underline-offset-4', pending && 'cursor-progress')}>
      {pending ? 'Restoring…' : 'Show the job board normally'}
    </button>
  )
}

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn('text-sm font-medium text-muted-foreground transition-colors hover:text-foreground', pending && 'cursor-progress')}>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

function Badge({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
      <span className="sr-only">New: </span>
      {n}
    </span>
  )
}

function PlaceList({ collapsed, onNavigate, ...props }: RedesignNavProps & { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const places = redesignPlacesFor({ moneyHelp: props.moneyHelp })
  const current = redesignPlaceForPath(pathname, places)
  const entriesFor = (place: (typeof places)[number]) => menuEntries(place, pathname, { employed: props.employed, earlyCareer: props.earlyCareer, locks: props.locks, paidAccess: props.paidAccess, senior: props.senior })
  // Once per browser session: the overlay is on, and why.
  useEffect(() => {
    if (!props.senior?.on) return
    try {
      if (window.sessionStorage.getItem('nc-senior-overlay')) return
      window.sessionStorage.setItem('nc-senior-overlay', '1')
    } catch {}
    posthog.capture('senior_overlay_applied', { source: props.seniorSource ?? 'detected', jobsRestored: props.senior.jobsRestored })
  }, [props.senior?.on, props.senior?.jobsRestored, props.seniorSource])
  return (
    <nav aria-label="Main" className={cn('flex h-full flex-col gap-3 py-6', collapsed ? 'items-center px-2' : 'px-4')}>
      {!collapsed && <Logo className="px-2 text-xl text-ink" />}
      <ul className="w-full space-y-px">
        {places
          .filter((p) => p.key !== 'help')
          .map((place) => {
            const Icon = ICONS[place.key]
            const active = current?.key === place.key
            const entries = entriesFor(place)
            const open = entries.find((e) => e.href)
            const href = open?.href ?? null
            return (
              <li key={place.key}>
                {href ? (
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? place.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md border-l-[3px] px-2 py-2 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : 'justify-between',
                      active ? 'border-ink bg-muted font-semibold text-ink' : 'border-transparent text-foreground/80 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                      <span className={cn('truncate', collapsed && 'sr-only')}>{place.label}</span>
                    </span>
                    {!collapsed && <Badge n={props.badges?.[place.key]} />}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="flex items-center justify-between gap-2 px-2 py-2 text-sm text-muted-foreground/60">
                    <span className="flex items-center gap-2.5">
                      <Icon className="size-4" aria-hidden />
                      <span className={cn(collapsed && 'sr-only')}>{place.label}</span>
                    </span>
                    {!collapsed && <Lock className="size-3.5 text-orange" aria-hidden />}
                  </span>
                )}
                {active && !collapsed && entries.length > 1 && (
                  <ul className="mt-1 mb-2 ml-[1.15rem] space-y-0.5 border-l border-border pl-3">
                    {entries.map((e) => (
                      <li key={e.label}>
                        {e.href ? (
                          <>
                          <Link
                            href={e.href}
                            onClick={onNavigate}
                            aria-current={e.active ? 'page' : undefined}
                            className={cn('block rounded-md px-2 py-1.5 text-sm', e.active ? 'bg-muted font-semibold text-ink' : e.muted ? 'text-muted-foreground/60 hover:text-ink' : 'text-muted-foreground hover:text-ink')}
                          >
                            {e.label}
                          </Link>
                          {e.muted && <RestoreJobs />}
                          </>
                        ) : (
                          <span aria-disabled="true" title={e.lockReason ?? undefined} className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground/60">
                            {e.label}
                            <Lock className="size-3 text-orange" aria-hidden />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
      </ul>
      <div className={cn('mt-auto space-y-2', collapsed ? 'flex flex-col items-center' : 'px-2')}>
        <Link
          href="/dashboard/support"
          onClick={onNavigate}
          aria-current={current?.key === 'help' ? 'page' : undefined}
          title={collapsed ? 'Help' : undefined}
          className={cn('flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-muted', current?.key === 'help' ? 'text-ink' : 'text-foreground/80')}
        >
          <LifeBuoy className="size-4" strokeWidth={1.75} aria-hidden />
          <span className={cn(collapsed && 'sr-only')}>Help</span>
          {!collapsed && <Badge n={props.badges?.help} />}
        </Link>
        {!collapsed && (
          <SignOutForm action={signOut}>
            <SignOutButton />
          </SignOutForm>
        )}
      </div>
    </nav>
  )
}

// The menu: a sidebar that opens the active place, and shrinks to icons so the page gets the width.
// The choice is remembered, and tells the layout through a data attribute (globals.css).
export function RedesignNav(props: RedesignNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
      } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.ncNav = collapsed ? 'collapsed' : 'open'
    return () => {
      delete document.documentElement.dataset.ncNav
    }
  }, [collapsed])

  const toggle = () =>
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, c ? '0' : '1')
      } catch {}
      return !c
    })

  const places = redesignPlacesFor({ moneyHelp: props.moneyHelp })
  const current = redesignPlaceForPath(pathname, places)
  const onPhoneTab = !!current && PHONE_TABS.includes(current.key)

  return (
    <>
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden overflow-y-auto border-r border-border bg-white transition-[width] lg:block', collapsed ? 'w-16' : 'w-72')}>
        <div className={cn('absolute top-5 z-10', collapsed ? 'inset-x-0 flex justify-center' : 'right-3')}>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand the menu' : 'Shrink the menu to icons'}
            aria-expanded={!collapsed}
            className="inline-flex size-8 items-center justify-center rounded-md text-ink/70 hover:bg-muted hover:text-ink"
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
          </button>
        </div>
        <div className={cn(collapsed && 'pt-10')}>
          <PlaceList {...props} collapsed={collapsed} />
        </div>
      </aside>

      <div className="border-b border-border bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo className="text-lg" />
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Open full navigation menu" className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground">
            <Menu className="size-5" />
            Menu
          </button>
        </div>
      </div>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {PHONE_TABS.map((key) => {
          const place = places.find((p) => p.key === key)
          if (!place) return null
          const Icon = ICONS[key]
          const active = current?.key === key
          return (
            <Link key={key} href={place.href} aria-current={active ? 'page' : undefined} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active ? 'text-ink' : 'text-muted-foreground')}>
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
                {props.badges?.[key] ? <span className="absolute -top-1.5 -right-3 rounded-full bg-ink px-1 text-[9px] font-semibold text-white">{props.badges[key]}</span> : null}
              </span>
              {place.label}
            </Link>
          )
        })}
        <button type="button" onClick={() => setOpen(true)} aria-label="Open full navigation menu" className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', current && !onPhoneTab ? 'text-ink' : 'text-muted-foreground')}>
          <Menu className="size-5" strokeWidth={current && !onPhoneTab ? 2.5 : 2} />
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-end px-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation menu" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <PlaceList {...props} collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
