import type { ReactNode } from 'react'
import { Calendar, Home, Mail, Settings, UserPlus, Users } from 'lucide-react'
import { PortalTypeBar } from '@/components/partners/PortalTypeBar'
import { cn } from '@/lib/utils'

// Shared frame for the coach mockups: the coach portal's top bar, a quiet left menu, and the candidate-site look
// inside. Sample data only. Maya Ortiz is a made-up independent coach and Dana Whitfield a made-up member.

const LINKS: { key: string; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'clients', label: 'Clients', Icon: Users },
  { key: 'messages', label: 'Messages', Icon: Mail },
  { key: 'calendar', label: 'Calendar and booking', Icon: Calendar },
  { key: 'invite', label: 'Invite a client', Icon: UserPlus },
  { key: 'settings', label: 'Settings', Icon: Settings },
]

export function CoachShell({ active, trail, children }: { active: string; trail: ReactNode; children: ReactNode }) {
  return (
    <div className="theme-candidate theme-redesign min-h-screen bg-white">
      <PortalTypeBar type="coach" brand={{ name: 'Maya Ortiz Coaching', logoUrl: null, accent: '#8ab17d' }}>
        <span className="hidden text-sm text-white/80 md:block">Maya Ortiz</span>
      </PortalTypeBar>
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-border px-4 py-6 lg:block" aria-label="Coach menu">
          <nav className="space-y-1">
            {LINKS.map(({ key, label, Icon }) => (
              <a key={key} href="#" aria-current={key === active ? 'page' : undefined} className={cn('flex items-center gap-2.5 rounded-md border-l-[3px] px-2 py-2 text-sm font-semibold', key === active ? 'border-ink bg-muted text-ink' : 'border-transparent text-ink/80 hover:bg-muted')}>
                <Icon className="size-4" aria-hidden />
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">
          <div className="mx-auto max-w-6xl space-y-8">
            <p className="text-sm text-muted-foreground">{trail}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// A short run of adjacent buttons for a choice of two to four options. One is selected (ink), never the action color.
export function Choices({ label, options, on }: { label: string; options: string[]; on: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <span key={o} className={cn('inline-flex items-center rounded-lg border px-3.5 py-1.5 text-sm font-semibold', o === on ? 'border-ink bg-ink text-white' : 'border-border text-ink')}>{o}</span>
      ))}
    </div>
  )
}

export const Why = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">Why: {children}</p>

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-border p-5', className)}>{children}</div>
)
