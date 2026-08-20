'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useFormStatus } from 'react-dom'
import {
  Home,
  Briefcase,
  Users,
  User,
  Menu,
  X,
  Target,
  ClipboardCheck,
  Megaphone,
  Star,
  MessageCircle,
  Inbox,
  GraduationCap,
  Building2,
  BookOpen,
  Video,
  Repeat,
  PartyPopper,
  Contact,
  FolderOpen,
  BarChart3,
  Shield,
  HeartHandshake,
  LifeBuoy,
  HelpCircle,
  Award,
  Gift,
  LineChart,
  Lock,
  Landmark,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/dashboard/actions'

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

interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  badge?: string
  muted?: boolean
  disabled?: boolean
  // Swaps the leading icon for an orange Lock and mutes the row — distinct
  // from the plain gray `disabled` treatment (Coming Soon items) since this
  // is a real, connection-gated feature, not "not built yet." The text
  // explains what unlocks it, shown as a title tooltip since there's no
  // room for body copy in a sidebar row (design-principles.md: never
  // disable without explaining why).
  lockReason?: string
}

interface NavSection {
  title: string | null // null = ungrouped top items
  links: NavLink[]
}

// Prompt 83 point 8 — "Priority" used to sit on 5 sidebar items at once,
// which meant it conveyed nothing. Position in the list already carries
// priority (each section is authored most-important-first), so the static
// label is gone; only a real, live, differentiated signal (an unread count,
// a genuinely new backchannel match) still earns a badge.
function buildSections(
  portfolioAssetCount: number,
  supportNetworkUnreadCount: number,
  messagesUnreadCount: number,
  newBackchannelCount: number,
  hasEmailConnection: boolean,
  linkedInConnected: boolean,
  skillsAssessmentCompleted: boolean
): NavSection[] {
  const gmailLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = hasEmailConnection
    ? {}
    : { muted: true, disabled: true, lockReason: 'Unlocks once you connect Gmail on your Profile page' }
  const linkedInLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = linkedInConnected
    ? {}
    : { muted: true, disabled: true, lockReason: 'Unlocks once you connect LinkedIn on your Profile page' }
  const skillsLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = skillsAssessmentCompleted
    ? {}
    : { muted: true, disabled: true, lockReason: 'Unlocks once you complete the Skills Assessment' }

  return [
    {
      title: null,
      links: [{ href: '/dashboard', label: 'Success Dashboard (Homepage)', icon: Home }],
    },
    {
      title: 'Personalize',
      links: [
        { href: '/dashboard/profile', label: 'My Profile', icon: User },
        { href: '/dashboard/search-strategy', label: 'My Search Strategy', icon: Target },
        { href: '/dashboard/skills-assessments', label: 'Skills & Behavioral Assessments', icon: ClipboardCheck },
        { href: '/dashboard/membership', label: 'Membership', icon: Award },
      ],
    },
    {
      title: 'Connecting',
      links: [
        { href: '/dashboard/marketing-plan', label: 'My Marketing Plan', icon: Megaphone, ...linkedInLock },
        {
          href: '/dashboard/network',
          label: 'Network with Contacts',
          icon: Users,
          // A real "you know someone at a company you applied to" count is
          // a specific, live reason to visit right now — kept as a badge
          // since it's genuinely differentiated, unlike the old static
          // "Priority" label every item here used to carry.
          badge: newBackchannelCount > 0 ? String(newBackchannelCount) : undefined,
          ...gmailLock,
        },
        { href: '/dashboard/references', label: 'My References', icon: Star },
        {
          href: '/dashboard/community',
          label: 'NextChapter Community',
          icon: MessageCircle,
          badge: supportNetworkUnreadCount > 0 ? String(supportNetworkUnreadCount) : undefined,
        },
        {
          href: '/dashboard/messages',
          label: 'My Inbox',
          icon: Inbox,
          badge: messagesUnreadCount > 0 ? String(messagesUnreadCount) : undefined,
        },
        // Deliberately protected during this redesign, not incidentally
        // preserved — Executive Coach stays a top-level, expanded-by-
        // default Connecting item with its own distinct "Premium" badge,
        // not folded into a generic collapsed catch-all category. Real
        // monetization surface area (see Prompt 78's negotiation
        // coaching, the coaching-commission revenue stream). Executive
        // Coach, Executive Recruiter, and Market Intelligence now all route
        // to the same /dashboard/premium waitlist page — one bundled
        // account tier instead of three separate asks.
        { href: '/dashboard/premium', label: 'Executive Coach', icon: GraduationCap, badge: 'Premium' },
        {
          href: '/dashboard/premium',
          label: 'Executive Recruiter',
          icon: Building2,
          badge: 'Premium',
        },
      ],
    },
    {
      title: 'Working and Learning',
      links: [
        { href: '/dashboard/find-my-job', label: 'Find a Full-time Job', icon: Briefcase, ...gmailLock },
        { href: '/dashboard/interim-work', label: 'Find Interim Work', icon: Repeat, ...gmailLock },
        { href: '/dashboard/learning', label: 'Learn New Skills', icon: BookOpen, ...skillsLock },
        { href: '/dashboard/webinars', label: 'Videos and Webinars', icon: Video, ...skillsLock },
        { href: '/dashboard/got-hired', label: 'Got An Offer 🎉', icon: PartyPopper },
      ],
    },
    {
      title: 'Data',
      links: [
        { href: '/dashboard/network/contacts', label: 'Contacts', icon: Contact, ...gmailLock },
        { href: '/dashboard/companies', label: 'Companies', icon: Landmark },
        {
          href: '/dashboard/portfolio',
          label: 'My Portfolio',
          icon: FolderOpen,
          badge: portfolioAssetCount > 0 ? String(portfolioAssetCount) : undefined,
        },
        { href: '/dashboard/stats', label: 'My Stats', icon: BarChart3 },
        {
          href: '/dashboard/premium',
          label: 'Market Intelligence',
          icon: LineChart,
          badge: 'Premium',
        },
      ],
    },
    {
      title: 'Misc',
      links: [
        { href: '/dashboard/benefits-network', label: 'Alumni Career Services and Benefit', icon: Gift },
        { href: '/dashboard/benefits', label: 'Benefits & Financial Bridge', icon: HeartHandshake },
        { href: '/dashboard/support', label: "I'm Struggling", icon: LifeBuoy },
        { href: '/dashboard/privacy', label: 'Privacy Settings', icon: Shield },
        { href: '/faq', label: 'FAQ', icon: HelpCircle },
      ],
    },
  ]
}

function NavContent({
  pathname,
  onNavigate,
  portfolioAssetCount,
  supportNetworkUnreadCount,
  messagesUnreadCount,
  newBackchannelCount,
  hasEmailConnection,
  linkedInConnected,
  skillsAssessmentCompleted,
  collapsedSections,
  onToggleSection,
}: {
  pathname: string
  onNavigate?: () => void
  portfolioAssetCount: number
  supportNetworkUnreadCount: number
  messagesUnreadCount: number
  newBackchannelCount: number
  hasEmailConnection: boolean
  linkedInConnected: boolean
  skillsAssessmentCompleted: boolean
  collapsedSections: Set<string>
  onToggleSection: (title: string) => void
}) {
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
  const sections = buildSections(
    portfolioAssetCount,
    supportNetworkUnreadCount,
    messagesUnreadCount,
    newBackchannelCount,
    hasEmailConnection,
    linkedInConnected,
    skillsAssessmentCompleted
  )

  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-6">
      <Logo className="px-2 text-xl text-navy" />
      {sections.map((section, i) => {
        const collapsed = !!section.title && collapsedSections.has(section.title)
        return (
        <div key={section.title ?? `top-${i}`} className="space-y-px">
          {section.title && (
            <button
              type="button"
              onClick={() => onToggleSection(section.title!)}
              aria-expanded={!collapsed}
              className="flex w-full items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
            >
              {section.title}
              <svg
                viewBox="0 0 24 24"
                className={cn('size-3.5 shrink-0 text-brand transition-transform', collapsed && '-rotate-90')}
                fill="none"
                stroke="currentColor"
                strokeWidth={3.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {!collapsed && section.links.map((link) => {
            const badgeEl = link.badge && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap tracking-wide uppercase',
                  link.badge === 'Premium'
                    ? 'bg-success/15 text-success'
                    : link.muted
                      ? 'bg-light-gray text-muted-foreground'
                      : 'bg-brand/15 text-brand'
                )}
              >
                {link.badge}
              </span>
            )

            const Icon = link.icon

            if (link.disabled) {
              // lockReason items are gated on something the candidate can
              // actually go do (connect Gmail, finish Skills Assessment) —
              // orange signals "in reach." Premium/Coming Soon items have no
              // action available yet, so the lock stays neutral gray.
              const lockTitle = link.lockReason ?? (link.badge === 'Premium' ? 'Premium feature — available soon' : undefined)
              return (
                <div
                  key={`${section.title ?? 'top'}-${link.href}`}
                  aria-disabled="true"
                  title={lockTitle}
                  className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="truncate">{link.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {badgeEl}
                    <Lock
                      className={cn('size-3.5 shrink-0', link.lockReason ? 'text-orange' : 'text-muted-foreground/60')}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </span>
                </div>
              )
            }

            const active = isActive(link.href)
            return (
              <Link
                key={`${section.title ?? 'top'}-${link.href}`}
                href={link.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border-l-[3px] px-2 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-brand bg-brand/8 font-semibold text-brand'
                    : link.muted
                      ? 'border-transparent text-muted-foreground/60 hover:bg-light-gray hover:text-muted-foreground'
                      : 'border-transparent text-foreground/80 hover:bg-light-gray hover:text-foreground'
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  <span className="truncate">{link.label}</span>
                </span>
                {badgeEl}
              </Link>
            )
          })}
        </div>
        )
      })}
      <div className="mt-auto px-2">
        <form action={signOut}>
          <SignOutButton />
        </form>
      </div>
    </nav>
  )
}

// Prompt 83 point 11 — mobile bottom navigation, limited to 5 destinations,
// consistent with the simplified sidebar's own top priorities. "More" opens
// the same full drawer as the old hamburger, so nothing in the fuller nav
// list becomes unreachable on mobile.
const MOBILE_TABS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/find-my-job', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/network', label: 'Network', icon: Users },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
] as const

export function DashboardNav({
  portfolioAssetCount = 0,
  supportNetworkUnreadCount = 0,
  messagesUnreadCount = 0,
  newBackchannelCount = 0,
  hasEmailConnection = false,
  linkedInConnected = false,
  skillsAssessmentCompleted = false,
}: {
  portfolioAssetCount?: number
  supportNetworkUnreadCount?: number
  messagesUnreadCount?: number
  newBackchannelCount?: number
  hasEmailConnection?: boolean
  linkedInConnected?: boolean
  skillsAssessmentCompleted?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Data and Misc start collapsed, everything else expanded — same literal
  // default on server and first client render to avoid a hydration
  // mismatch; a saved per-user state (if any) loads a frame later and
  // overrides this.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['Data', 'Misc']))

  useEffect(() => {
    const saved = localStorage.getItem('nc-nav-collapsed-sections')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setCollapsedSections(new Set(JSON.parse(saved)))
  }, [])

  function toggleSection(title: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      localStorage.setItem('nc-nav-collapsed-sections', JSON.stringify([...next]))
      return next
    })
  }

  const isMobileTabActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
  const onKnownMobileTab = MOBILE_TABS.some((t) => isMobileTabActive(t.href))

  return (
    <>
      {/* Desktop: persistent light sidebar (Prompt 83 — replaces the dark-
          navy container from Prompt 66; Prompt 66's icon set, grade colors,
          and status colors are untouched, only this shell changed). */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-white lg:block">
        <NavContent
          pathname={pathname}
          portfolioAssetCount={portfolioAssetCount}
          supportNetworkUnreadCount={supportNetworkUnreadCount}
          messagesUnreadCount={messagesUnreadCount}
          newBackchannelCount={newBackchannelCount}
          hasEmailConnection={hasEmailConnection}
          linkedInConnected={linkedInConnected}
          skillsAssessmentCompleted={skillsAssessmentCompleted}
          collapsedSections={collapsedSections}
          onToggleSection={toggleSection}
        />
      </aside>

      {/* Mobile: top bar (logo + full-menu toggle) */}
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

      {/* Mobile: persistent bottom tab bar, 5 destinations */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MOBILE_TABS.map((tab) => {
          const active = isMobileTabActive(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                active ? 'text-brand' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open full navigation menu"
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
            !onKnownMobileTab ? 'text-brand' : 'text-muted-foreground'
          )}
        >
          <Menu className="size-5" strokeWidth={!onKnownMobileTab ? 2.5 : 2} />
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
            <NavContent
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              portfolioAssetCount={portfolioAssetCount}
              supportNetworkUnreadCount={supportNetworkUnreadCount}
              messagesUnreadCount={messagesUnreadCount}
              newBackchannelCount={newBackchannelCount}
              hasEmailConnection={hasEmailConnection}
              linkedInConnected={linkedInConnected}
              skillsAssessmentCompleted={skillsAssessmentCompleted}
              collapsedSections={collapsedSections}
              onToggleSection={toggleSection}
            />
          </div>
        </div>
      )}
    </>
  )
}
