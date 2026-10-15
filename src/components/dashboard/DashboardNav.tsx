'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useFormStatus } from 'react-dom'
import { Home, Briefcase, Users, BookOpen, User, LifeBuoy, Menu, X, Lock, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/dashboard/actions'
import { PLACES, entryHref, placeForPath, type PlaceKey } from '@/lib/nav/places'

function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
        pending && 'cursor-progress'
      )}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

const ICONS: Record<PlaceKey, LucideIcon> = {
  home: Home,
  jobs: Briefcase,
  network: Users,
  learn: BookOpen,
  personalize: User,
  help: LifeBuoy,
}

// The phone tab bar shows the four places used most; Learn and Help live
// under "More", which opens the same six-item list.
const PHONE_TABS: PlaceKey[] = ['home', 'jobs', 'network', 'personalize']

interface NavProps {
  // Live counts, one per place. A badge only ever means "something new for
  // you here": a number, never a static label.
  badges: Partial<Record<PlaceKey, number>>
  hasEmailConnection: boolean
  skillsAssessmentCompleted: boolean
  employed: boolean
}

function PlaceList({ pathname, onNavigate, badges, hasEmailConnection, skillsAssessmentCompleted, employed }: NavProps & { pathname: string; onNavigate?: () => void }) {
  const current = placeForPath(pathname)?.key ?? null
  const locks = { hasEmailConnection, skillsAssessmentCompleted }
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-3 px-4 py-6">
      <Logo className="px-2 text-xl text-navy" />
      <ul className="space-y-px">
        {PLACES.filter((p) => p.key !== 'help').map((place) => {
          const Icon = ICONS[place.key]
          const active = current === place.key
          const href = entryHref(place, locks, employed)
          const badge = badges[place.key]
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span className="truncate">{place.label}</span>
              </span>
              {badge ? (
                <span className="shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                  <span className="sr-only">New: </span>
                  {badge}
                </span>
              ) : null}
            </>
          )
          return (
            <li key={place.key}>
              {href ? (
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md border-l-[3px] px-2 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-brand bg-brand/8 font-semibold text-brand'
                      : 'border-transparent text-foreground/80 hover:bg-light-gray hover:text-foreground'
                  )}
                >
                  {body}
                </Link>
              ) : (
                <span aria-disabled="true" className="flex items-center justify-between gap-2 px-2 py-2 text-sm text-muted-foreground/60">
                  {body}
                  <Lock className="size-3.5 text-orange" aria-hidden />
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-auto space-y-2 px-2">
        <Link
          href="/dashboard/support"
          onClick={onNavigate}
          aria-current={current === 'help' ? 'page' : undefined}
          className={cn(
            'flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-light-gray',
            current === 'help' ? 'text-brand' : 'text-foreground/80'
          )}
        >
          <span className="flex items-center gap-2.5">
            <LifeBuoy className="size-4" strokeWidth={1.75} aria-hidden />
            Help
          </span>
          {badges.help ? (
            <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
              <span className="sr-only">New: </span>
              {badges.help}
            </span>
          ) : null}
        </Link>
        <form action={signOut}>
          <SignOutButton />
        </form>
      </div>
    </nav>
  )
}

export function DashboardNav({
  badges = {},
  hasEmailConnection = false,
  skillsAssessmentCompleted = false,
  employed = false,
}: Partial<NavProps>) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = placeForPath(pathname)?.key ?? null
  const locks = { hasEmailConnection, skillsAssessmentCompleted }
  const shared = { badges, hasEmailConnection, skillsAssessmentCompleted, employed }
  const onPhoneTab = current !== null && PHONE_TABS.includes(current)

  return (
    <>
      {/* Desktop: persistent sidebar with the six places. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-white lg:block">
        <PlaceList pathname={pathname} {...shared} />
      </aside>

      {/* Phone: top bar */}
      <div className="border-b border-border bg-background lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo className="text-lg" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Open full navigation menu"
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground"
          >
            <Menu className="size-5" />
            Menu
          </button>
        </div>
      </div>

      {/* Phone: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {PHONE_TABS.map((key) => {
          const place = PLACES.find((p) => p.key === key)!
          const Icon = ICONS[key]
          const active = current === key
          const href = entryHref(place, locks, employed)
          const badge = badges[key]
          const inner = (
            <>
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
                {badge ? (
                  <span className="absolute -top-1.5 -right-3 rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
                    {badge}
                  </span>
                ) : null}
              </span>
              {place.label}
            </>
          )
          return href ? (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active ? 'text-brand' : 'text-muted-foreground')}
            >
              {inner}
            </Link>
          ) : (
            <span key={key} aria-disabled="true" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground/60">
              {inner}
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open full navigation menu"
          className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', current !== null && !onPhoneTab ? 'text-brand' : 'text-muted-foreground')}
        >
          <Menu className="size-5" strokeWidth={current !== null && !onPhoneTab ? 2.5 : 2} />
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-2 text-muted-foreground hover:bg-light-gray hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <PlaceList pathname={pathname} onNavigate={() => setOpen(false)} {...shared} />
          </div>
        </div>
      )}
    </>
  )
}
