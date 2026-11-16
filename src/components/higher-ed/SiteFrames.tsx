import type { ReactNode } from 'react'
import Link from 'next/link'
import { BookOpen, Briefcase, Home, LifeBuoy, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react'
import { chromeFor } from '@/components/partners/PartnerTopBar'
import { cn } from '@/lib/utils'

// The participant and employer views in a workforce portal are previews for the program's staff
// (src/app/i/[slug]/(portal)/layout.tsx folds them under "See it as"). They are drawn in the frame of the
// real site each person uses: a participant's own NextChapter account (the candidate menu, same places and
// names as /dashboard) and a member company's employer portal (the navy employer menu). The program shows
// up inside them the way it does for real: as one of the participant's groups, and as the company's membership.

type Tab = { key: string; label: string }

type Place = { id: string; label: string; icon: LucideIcon; entries: { tab: string; label: string }[] }

// The candidate menu's places, in the same order and words as the dashboard (docs/candidate-redesign.md).
// Each entry points at the portal tab that shows that part of the program.
const PLACES: Place[] = [
  { id: 'home', label: 'Home', icon: Home, entries: [{ tab: 'home', label: 'Your week' }] },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, entries: [] },
  { id: 'network', label: 'Network', icon: Users, entries: [{ tab: 'groups', label: 'Groups' }, { tab: 'coaching', label: 'Coaching' }] },
  { id: 'learn', label: 'Learn', icon: BookOpen, entries: [{ tab: 'programs', label: 'Skills and courses' }] },
  { id: 'money', label: 'Finances and benefits', icon: Wallet, entries: [] },
  { id: 'account', label: 'Account and privacy', icon: UserCog, entries: [{ tab: 'privacy', label: 'Privacy' }] },
]

export function ParticipantSiteFrame({
  base,
  tabs,
  active,
  firstName,
  groupName,
  children,
}: {
  base: string
  tabs: Tab[]
  active: string
  firstName: string | null
  groupName: string
  children: ReactNode
}) {
  const open = new Set(tabs.map((t) => t.key))
  const hrefOf = (tab: string) => (tab === tabs[0]?.key ? base : `${base}/${tab}`)
  const places = PLACES.map((p) => ({ ...p, entries: p.entries.filter((e) => open.has(e.tab)) }))
  const current = places.find((p) => p.entries.some((e) => e.tab === active))
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        What {firstName ?? 'a participant'} sees in their own NextChapter account. {groupName} shows up inside it as one of their groups.
      </p>
      <div className="theme-candidate theme-redesign overflow-hidden rounded-2xl border border-border bg-white text-ink shadow-sm lg:grid lg:grid-cols-[15rem_1fr]">
        <aside className="border-b border-border bg-white px-4 py-5 lg:border-r lg:border-b-0">
          <p className="px-2 pb-4 text-xl font-bold text-ink">NextChapter</p>
          <nav aria-label="Participant menu" className="flex flex-wrap gap-1 lg:block lg:space-y-1">
            {places.map((p) => {
              const Icon = p.icon
              const isActive = p === current
              const first = p.entries[0]
              const row = cn('flex items-center gap-2.5 rounded-md border-l-[3px] px-2 py-2 text-sm font-semibold', isActive ? 'border-ink bg-muted text-ink' : 'border-transparent')
              return (
                <div key={p.id}>
                  {first ? (
                    <Link href={hrefOf(first.tab)} aria-current={isActive ? 'page' : undefined} className={cn(row, !isActive && 'text-ink/80 hover:bg-muted')}>
                      <Icon className="size-4" aria-hidden />
                      {p.label}
                    </Link>
                  ) : (
                    <span className={cn(row, 'text-ink/60')}>
                      <Icon className="size-4" aria-hidden />
                      {p.label}
                    </span>
                  )}
                  {isActive && p.entries.length > 1 && (
                    <ul className="mt-1 mb-2 ml-[1.15rem] hidden space-y-0.5 border-l border-border pl-3 lg:block">
                      {p.entries.map((e) => (
                        <li key={e.tab}>
                          <Link
                            href={hrefOf(e.tab)}
                            aria-current={e.tab === active ? 'page' : undefined}
                            className={cn('block rounded-md px-2 py-1.5 text-sm', e.tab === active ? 'bg-muted font-semibold text-ink' : 'text-muted-foreground hover:text-ink')}
                          >
                            {e.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            <span className="flex items-center gap-2.5 border-l-[3px] border-transparent px-2 py-2 text-sm font-semibold text-ink/60 lg:mt-4">
              <LifeBuoy className="size-4" aria-hidden />
              Help
            </span>
          </nav>
          <p className="mt-4 hidden px-2 text-xs text-muted-foreground lg:block">
            Grey places are the participant&apos;s own search. This preview opens only where {groupName} appears.
          </p>
        </aside>
        <div className="min-w-0 px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-4xl space-y-6">
            {current && (
              <p className="text-sm text-muted-foreground">
                {current.label}
                {current.id !== 'home' && (
                  <>
                    {' '}
                    <span aria-hidden>›</span> <span className="text-ink">{current.entries.find((e) => e.tab === active)?.label}</span>
                  </>
                )}
              </p>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function EmployerSiteFrame({
  base,
  tabs,
  active,
  companyName,
  groupName,
  children,
}: {
  base: string
  tabs: Tab[]
  active: string
  companyName: string | null
  groupName: string
  children: ReactNode
}) {
  const hrefOf = (tab: string) => (tab === tabs[0]?.key ? base : `${base}/${tab}`)
  const chrome = chromeFor('employer')
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        What {companyName ?? 'a member company'} sees in its NextChapter employer portal, as a member of {groupName}.
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 text-white" style={{ backgroundColor: chrome }}>
          <span className="shrink-0 text-base font-bold">NextChapter</span>
          <span className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold">Employer</span>
          {companyName && <span className="min-w-0 truncate text-sm font-medium">{companyName}</span>}
          <span className="ml-auto hidden shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium sm:inline">Member of {groupName}</span>
        </div>
        <div className="lg:grid lg:grid-cols-[13rem_1fr]">
          <nav aria-label="Employer menu" className="flex flex-wrap gap-0.5 px-3 py-3 lg:block lg:space-y-0.5 lg:py-6" style={{ backgroundColor: chrome }}>
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={hrefOf(t.key)}
                aria-current={t.key === active ? 'page' : undefined}
                className={cn('block rounded-md px-2 py-1.5 text-xs font-medium transition-colors', t.key === active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white')}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="min-w-0 bg-background px-5 py-6 sm:px-8 sm:py-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
