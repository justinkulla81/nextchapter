import Link from 'next/link'
import { BookOpen, Briefcase, Home, LifeBuoy, User, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROPOSED_NAV, type PlaceId } from './proposed-nav'

const ICONS: Record<PlaceId, LucideIcon> = { home: Home, jobs: Briefcase, network: Users, learn: BookOpen, personalize: User, help: LifeBuoy }

// Where a mockup page lives. Each page names its place, entry and (optionally) part, and the shell draws
// the proposed menu around it: the active place opens to show its entries, and an entry with parts shows
// small switches at the top of the page, with a "where you are" line above.
export function PreviewShell({ place, entry, part, wide = false, children }: { place: PlaceId; entry: string; part?: string; wide?: boolean; children: React.ReactNode }) {
  const p = PROPOSED_NAV.find((x) => x.id === place)!
  const e = p.entries.find((x) => x.key === entry)!
  const href = (pl: string, en: string, pa?: string) => `/dev-preview/${pl}/${en}${pa ? `/${pa}` : ''}`
  return (
    <div className="theme-candidate min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto border-r border-border bg-white px-4 py-6 lg:block">
        <p className="px-2 pb-4 text-xl font-bold text-ink">NextChapter</p>
        <nav aria-label="Main" className="space-y-1">
          {PROPOSED_NAV.filter((x) => x.id !== 'help').map((pl) => {
            const Icon = ICONS[pl.id]
            const active = pl.id === place
            return (
              <div key={pl.id}>
                <Link
                  href={href(pl.id, pl.entries[0].key, pl.entries[0].parts?.[0]?.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex items-center gap-2.5 rounded-md border-l-[3px] px-2 py-2 text-sm font-semibold', active ? 'border-ink bg-muted text-ink' : 'border-transparent text-ink/80 hover:bg-muted')}
                >
                  <Icon className="size-4" aria-hidden />
                  {pl.label}
                </Link>
                {active && pl.entries.length > 1 && (
                  <ul className="mt-1 mb-2 ml-[1.15rem] space-y-0.5 border-l border-border pl-3">
                    {pl.entries.map((en) => (
                      <li key={en.key}>
                        <Link
                          href={href(pl.id, en.key, en.parts?.[0]?.key)}
                          aria-current={en.key === entry ? 'page' : undefined}
                          className={cn('block rounded-md px-2 py-1.5 text-sm', en.key === entry ? 'bg-muted font-semibold text-ink' : 'text-muted-foreground hover:text-ink')}
                        >
                          {en.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>
        <div className="absolute inset-x-4 bottom-6 space-y-2 px-2 text-sm">
          <p className="flex items-center gap-2.5 font-medium text-ink/80"><LifeBuoy className="size-4" aria-hidden />Help</p>
          <p className="text-muted-foreground">Sign out</p>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <p className="text-lg font-bold text-ink">NextChapter</p>
        <span className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink">Menu</span>
      </header>

      <main className="px-5 pt-10 pb-28 lg:pb-12 lg:pl-[calc(18rem+2.5rem)]">
        <div className={cn('mx-auto space-y-8', wide ? 'max-w-6xl' : 'max-w-4xl')}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {p.label}
              {place !== 'home' || entry !== 'today' ? <> <span aria-hidden>›</span> <span className="text-ink">{e.label}</span></> : null}
            </p>
            {e.parts && (
              <nav aria-label={`${e.label} parts`} className="flex flex-wrap gap-2">
                {e.parts.map((pa) => (
                  <Link
                    key={pa.key}
                    href={href(place, entry, pa.key)}
                    aria-current={pa.key === part ? 'page' : undefined}
                    className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', pa.key === part ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:text-ink')}
                  >
                    {pa.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          {children}
        </div>
      </main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white lg:hidden">
        {PROPOSED_NAV.filter((x) => ['home', 'jobs', 'network', 'personalize'].includes(x.id)).map((pl) => {
          const Icon = ICONS[pl.id]
          return (
            <Link key={pl.id} href={href(pl.id, pl.entries[0].key, pl.entries[0].parts?.[0]?.key)} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', pl.id === place ? 'text-ink' : 'text-muted-foreground')}>
              <Icon className="size-5" aria-hidden />
              {pl.label}
            </Link>
          )
        })}
        <span className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground">More</span>
      </nav>
    </div>
  )
}
