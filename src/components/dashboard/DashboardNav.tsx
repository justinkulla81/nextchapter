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
  Sparkles,
  LineChart,
  Lock,
  Landmark,
  School,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import { connectReason } from '@/lib/journey/engagement'
import type { JourneyStage, JourneyType } from '@/lib/journey/journey'
import { MENU_LABELS, MOBILE_TAB, PILLAR_ORDER, PILLAR_TITLES, itemPillar, itemVisibility, menuMode, statusUnlock, type MenuItemKey, type MenuMode } from '@/lib/journey/menu'
import { StatusUnlockBox } from '@/components/dashboard/StatusUnlockBox'
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

type MenuLink = NavLink & { key: MenuItemKey }

// What the sidebar shows follows the member's situation (src/lib/journey/menu.ts):
// each tool is shown, locked until their status changes, or hidden. Position in
// a section is priority, most important first. Only a real, live signal (an
// unread count, a new strong-fit company) earns a badge.
function buildSections(o: {
  portfolioAssetCount: number
  supportNetworkUnreadCount: number
  messagesUnreadCount: number
  needsFollowUpCount: number
  activeContactsCount: number
  hasEmailConnection: boolean
  linkedInConnected: boolean
  skillsAssessmentCompleted: boolean
  isEarlyCareer: boolean | null
  isActiveMember: boolean
  helpRepliesWaiting: number
  newStrongCompaniesCount: number
  journey: JourneyType | null
  stage: JourneyStage | null
}): { sections: NavSection[]; statusLocked: string[]; mode: MenuMode } {
  const { journey } = o
  const mode = menuMode(o.stage, o.journey)
  const unlock = statusUnlock(mode)

  const gmailLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = o.hasEmailConnection
    ? {}
    : { muted: true, disabled: true, lockReason: `Unlocks once you connect Gmail. ${connectReason(journey, 'gmail')} Connect on your Privacy page.` }
  const linkedInLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = o.linkedInConnected
    ? {}
    : { muted: true, disabled: true, lockReason: `Unlocks once you connect LinkedIn. ${connectReason(journey, 'linkedin')} Connect on your Profile page.` }
  const skillsLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = o.skillsAssessmentCompleted
    ? {}
    : { muted: true, disabled: true, lockReason: 'Unlocks once you complete the Skills Assessment' }
  // Real isActiveMember() gate (src/lib/membership/subscription.ts) — the same
  // one that gates Board & Advisory roles on Interim Work. Deliberately NOT
  // gated on /dashboard/premium: that is a separate waitlist product.
  const membershipLock: Pick<NavLink, 'muted' | 'disabled' | 'lockReason'> | Record<string, never> = o.isActiveMember
    ? {}
    : { muted: true, disabled: true, lockReason: 'Unlocks once you activate your NextChapter Membership' }

  const items: MenuLink[] = [
    // Personalize
    { key: 'strategy', href: '/dashboard/search-strategy', label: MENU_LABELS.strategy, icon: Target },
    { key: 'profile', href: '/dashboard/profile', label: MENU_LABELS.profile, icon: User },
    { key: 'assessments', href: '/dashboard/skills-assessments', label: MENU_LABELS.assessments, icon: ClipboardCheck },
    { key: 'marketReality', href: '/dashboard/market-reality', label: MENU_LABELS.marketReality, icon: LineChart },
    { key: 'worth', href: '/dashboard/pay', label: MENU_LABELS.worth, icon: LineChart },
    // Prove it
    { key: 'references', href: '/dashboard/references', label: MENU_LABELS.references, icon: Star },
    {
      key: 'portfolio',
      href: '/dashboard/portfolio',
      label: MENU_LABELS.portfolio,
      icon: FolderOpen,
      badge: o.portfolioAssetCount > 0 ? String(o.portfolioAssetCount) : undefined,
    },
    { key: 'marketing', href: '/dashboard/marketing-plan', label: MENU_LABELS.marketing, icon: Megaphone, ...linkedInLock },
    // Search and apply
    { key: 'jobs', href: '/dashboard/find-my-job', label: MENU_LABELS.jobs, icon: Briefcase, ...gmailLock },
    {
      key: 'companies',
      href: '/dashboard/companies',
      label: MENU_LABELS.companies,
      icon: Landmark,
      // Companies that newly became a strong fit since the member last opened
      // the directory — see countNewStrongCompanies.
      badge: o.newStrongCompaniesCount > 0 ? String(o.newStrongCompaniesCount) : undefined,
    },
    { key: 'interviewPrep', href: '/dashboard/interview-prep', label: MENU_LABELS.interviewPrep, icon: MessageSquare },
    { key: 'offer', href: '/dashboard/got-hired', label: MENU_LABELS.offer, icon: PartyPopper },
    { key: 'marketIntel', href: '/dashboard/premium', label: MENU_LABELS.marketIntel, icon: LineChart, badge: 'Premium' },
    // Network
    {
      key: 'network',
      href: '/dashboard/network',
      label: MENU_LABELS.network,
      icon: Users,
      // People who've met with or heard from the candidate with no thank-you or
      // follow-up sent yet (needs-follow-up.ts): a specific, live reason to visit.
      badge: o.needsFollowUpCount > 0 ? String(o.needsFollowUpCount) : undefined,
      ...gmailLock,
    },
    {
      key: 'contacts',
      href: '/dashboard/network/contacts',
      label: MENU_LABELS.contacts,
      icon: Contact,
      badge: o.activeContactsCount > 0 ? String(o.activeContactsCount) : undefined,
      ...gmailLock,
    },
    {
      key: 'community',
      href: '/dashboard/community',
      label: MENU_LABELS.community,
      icon: MessageCircle,
      badge: o.supportNetworkUnreadCount > 0 ? String(o.supportNetworkUnreadCount) : undefined,
    },
    {
      key: 'inbox',
      href: '/dashboard/messages',
      label: MENU_LABELS.inbox,
      icon: Inbox,
      badge: o.messagesUnreadCount > 0 ? String(o.messagesUnreadCount) : undefined,
    },
    { key: 'recruiter', href: '/dashboard/premium', label: MENU_LABELS.recruiter, icon: Building2, badge: 'Premium', ...membershipLock },
    { key: 'universities', href: '/dashboard/universities', label: MENU_LABELS.universities, icon: School },
    { key: 'collegeBenefits', href: '/dashboard/benefits-network', label: MENU_LABELS.collegeBenefits, icon: Gift },
    // Learn
    { key: 'learning', href: '/dashboard/learning', label: MENU_LABELS.learning, icon: BookOpen, ...skillsLock },
    { key: 'webinars', href: '/dashboard/webinars', label: MENU_LABELS.webinars, icon: Video, ...skillsLock },
    // Coaching: a real monetization surface, kept visible in every situation.
    { key: 'coach', href: '/dashboard/premium', label: MENU_LABELS.coach, icon: GraduationCap, badge: 'Premium', ...membershipLock },
    // Work now
    { key: 'interim', href: '/dashboard/interim-work', label: MENU_LABELS.interim, icon: Repeat, ...gmailLock },
    // Only offered once we positively know the candidate is NOT entry-level
    // (isEarlyCareer === null fails closed): EQoverIQ's audience is senior only.
    ...(o.isEarlyCareer === false
      ? [{ key: 'eqoveriq' as const, href: '/eqoveriq', label: MENU_LABELS.eqoveriq, icon: Sparkles }]
      : []),
    // Support and settings
    { key: 'stats', href: '/dashboard/stats', label: MENU_LABELS.stats, icon: BarChart3 },
    { key: 'benefits', href: '/dashboard/benefits', label: MENU_LABELS.benefits, icon: HeartHandshake },
    { key: 'struggling', href: '/dashboard/support', label: MENU_LABELS.struggling, icon: LifeBuoy },
    { key: 'membership', href: '/dashboard/membership', label: MENU_LABELS.membership, icon: Award },
    {
      key: 'help',
      href: '/dashboard/help',
      label: MENU_LABELS.help,
      icon: MessageSquare,
      badge: o.helpRepliesWaiting > 0 ? String(o.helpRepliesWaiting) : undefined,
    },
    { key: 'privacy', href: '/dashboard/privacy', label: MENU_LABELS.privacy, icon: Shield },
    { key: 'faq', href: '/faq', label: MENU_LABELS.faq, icon: HelpCircle },
    // Manage your career (staying put)
    { key: 'growWorth', href: '/dashboard/pay', label: MENU_LABELS.growWorth, icon: LineChart },
    { key: 'growCase', href: '/dashboard/review-prep', label: MENU_LABELS.growCase, icon: ClipboardCheck },
    { key: 'growResults', href: '/dashboard/track-record', label: MENU_LABELS.growResults, icon: ClipboardCheck },
    { key: 'growSkills', href: '/dashboard/learning', label: MENU_LABELS.growSkills, icon: BookOpen, ...skillsLock },
    { key: 'growConversation', href: '/dashboard/interview-prep', label: MENU_LABELS.growConversation, icon: MessageCircle },
    { key: 'growStyle', href: '/dashboard/how-i-perform', label: MENU_LABELS.growStyle, icon: User },
    // Manage your career (just landed)
    { key: 'careerFirst90', href: '/dashboard', label: MENU_LABELS.careerFirst90, icon: Home },
    { key: 'careerWorth', href: '/dashboard/pay', label: MENU_LABELS.careerWorth, icon: LineChart },
    { key: 'careerNetwork', href: '/dashboard/network', label: MENU_LABELS.careerNetwork, icon: Users, ...gmailLock },
  ]

  // Tools the member's current situation turns off: muted, with the reason and
  // a way to update their status (shown in the explainer under the menu).
  const statusLocked: string[] = []
  const sections: NavSection[] = [{ title: null, links: [{ href: '/dashboard', label: 'Success Dashboard (Homepage)', icon: Home }] }]
  for (const pillar of PILLAR_ORDER[mode]) {
    const links: NavLink[] = []
    for (const { key, ...link } of items) {
      if (itemPillar(key, mode) !== pillar) continue
      const v = itemVisibility(key, mode)
      if (v === 'hide') continue
      if (v === 'locked') {
        statusLocked.push(link.label)
        links.push({ ...link, muted: true, disabled: true, lockReason: unlock ? `${unlock.why} Use "Turn on more tools" below to update your status.` : undefined })
      } else {
        links.push(link)
      }
    }
    if (links.length > 0) sections.push({ title: PILLAR_TITLES[pillar], links })
  }
  return { sections, statusLocked, mode }
}

function NavContent({
  pathname,
  onNavigate,
  portfolioAssetCount,
  supportNetworkUnreadCount,
  messagesUnreadCount,
  needsFollowUpCount,
  activeContactsCount,
  hasEmailConnection,
  linkedInConnected,
  skillsAssessmentCompleted,
  isEarlyCareer,
  isActiveMember,
  helpRepliesWaiting,
  newStrongCompaniesCount,
  journey,
  stage,
  collapsedSections,
  onToggleSection,
}: {
  pathname: string
  onNavigate?: () => void
  portfolioAssetCount: number
  supportNetworkUnreadCount: number
  messagesUnreadCount: number
  needsFollowUpCount: number
  activeContactsCount: number
  hasEmailConnection: boolean
  linkedInConnected: boolean
  skillsAssessmentCompleted: boolean
  isEarlyCareer: boolean | null
  isActiveMember: boolean
  helpRepliesWaiting: number
  newStrongCompaniesCount: number
  journey: JourneyType | null
  stage: JourneyStage | null
  collapsedSections: Set<string>
  onToggleSection: (title: string) => void
}) {
  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
  const { sections, statusLocked, mode } = buildSections({
    portfolioAssetCount,
    supportNetworkUnreadCount,
    messagesUnreadCount,
    needsFollowUpCount,
    activeContactsCount,
    hasEmailConnection,
    linkedInConnected,
    skillsAssessmentCompleted,
    isEarlyCareer,
    isActiveMember,
    helpRepliesWaiting,
    newStrongCompaniesCount,
    journey,
    stage,
  })

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
                  key={`${section.title ?? 'top'}-${link.href}-${link.label}`}
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
                key={`${section.title ?? 'top'}-${link.href}-${link.label}`}
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
      {statusLocked.length > 0 && <StatusUnlockBox mode={mode} lockedTools={statusLocked} />}
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
// locksOn: 'gmail' mirrors the desktop sidebar's gmailLock for the same two
// destinations (Prompt 83 point 11 predates that lock and never applied it
// here — mobile could always tap through to a page the desktop sidebar
// treated as locked, an inconsistency this closes).
const SITUATIONAL_TAB = {
  jobs: { href: '/dashboard/find-my-job', label: 'Jobs', icon: Briefcase, locksOn: 'gmail' as const },
  plan: { href: '/dashboard/search-strategy', label: 'Plan', icon: Target },
  worth: { href: '/dashboard/pay', label: 'My worth', icon: LineChart },
  first90: { href: '/dashboard/got-hired', label: 'New job', icon: PartyPopper },
} as const

function mobileTabs(mode: MenuMode) {
  return [
    { href: '/dashboard', label: 'Home', icon: Home },
    SITUATIONAL_TAB[MOBILE_TAB[mode]],
    { href: '/dashboard/network', label: 'Network', icon: Users, locksOn: 'gmail' as const },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
  ] as readonly { href: string; label: string; icon: LucideIcon; locksOn?: 'gmail' }[]
}

export function DashboardNav({
  portfolioAssetCount = 0,
  supportNetworkUnreadCount = 0,
  messagesUnreadCount = 0,
  needsFollowUpCount = 0,
  activeContactsCount = 0,
  hasEmailConnection = false,
  linkedInConnected = false,
  skillsAssessmentCompleted = false,
  isEarlyCareer = null,
  isActiveMember = false,
  helpRepliesWaiting = 0,
  newStrongCompaniesCount = 0,
  journey = null,
  stage = null,
}: {
  portfolioAssetCount?: number
  supportNetworkUnreadCount?: number
  messagesUnreadCount?: number
  needsFollowUpCount?: number
  activeContactsCount?: number
  hasEmailConnection?: boolean
  linkedInConnected?: boolean
  skillsAssessmentCompleted?: boolean
  isEarlyCareer?: boolean | null
  isActiveMember?: boolean
  helpRepliesWaiting?: number
  newStrongCompaniesCount?: number
  journey?: JourneyType | null
  stage?: JourneyStage | null
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
  const tabs = mobileTabs(menuMode(stage, journey))
  const onKnownMobileTab = tabs.some((t) => isMobileTabActive(t.href))

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
          needsFollowUpCount={needsFollowUpCount}
          activeContactsCount={activeContactsCount}
          hasEmailConnection={hasEmailConnection}
          linkedInConnected={linkedInConnected}
          skillsAssessmentCompleted={skillsAssessmentCompleted}
          isEarlyCareer={isEarlyCareer}
          isActiveMember={isActiveMember}
            helpRepliesWaiting={helpRepliesWaiting}
          newStrongCompaniesCount={newStrongCompaniesCount}
          journey={journey}
          stage={stage}
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
        {tabs.map((tab) => {
          const active = isMobileTabActive(tab.href)
          const Icon = tab.icon
          const locked = 'locksOn' in tab && tab.locksOn === 'gmail' && !hasEmailConnection

          if (locked) {
            return (
              <div
                key={tab.href}
                aria-disabled="true"
                title={`Unlocks once you connect Gmail. ${connectReason(journey, 'gmail')} Connect on your Privacy page.`}
                className="flex flex-1 cursor-not-allowed flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground/60"
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                  <Lock className="absolute -right-1.5 -bottom-1 size-2.5 rounded-full bg-white text-orange" strokeWidth={2.5} aria-hidden />
                </span>
                {tab.label}
              </div>
            )
          }

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
              needsFollowUpCount={needsFollowUpCount}
              activeContactsCount={activeContactsCount}
              hasEmailConnection={hasEmailConnection}
              linkedInConnected={linkedInConnected}
              skillsAssessmentCompleted={skillsAssessmentCompleted}
              isEarlyCareer={isEarlyCareer}
              isActiveMember={isActiveMember}
            helpRepliesWaiting={helpRepliesWaiting}
              newStrongCompaniesCount={newStrongCompaniesCount}
              journey={journey}
              stage={stage}
              collapsedSections={collapsedSections}
              onToggleSection={toggleSection}
            />
          </div>
        </div>
      )}
    </>
  )
}
