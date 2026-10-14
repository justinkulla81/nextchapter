// The service menu a college switches on (product design, "Service menu:
// what a college can switch on"). One catalog; each college's choices live in
// Institution.enabledFeatures.services. Turning a service on puts its card on
// the Candidate home for the audiences picked, and every card open is counted
// (AnalyticsEvent `he_service_opened`), which is the usage shown to staff.
//
// Data, not code paths: adding a service is an entry here.

import type { WorkspaceKey } from './workspaces'

export type Audience = 'alumni' | 'students' | 'recent_grads' | 'parents' | 'in_transition'
export type Pricing = 'free' | 'paid' | 'donor'
export type ServiceGroup = 'core' | 'more' | 'campaigns'

export type Service = {
  key: string
  group: ServiceGroup
  name: string
  // One line, in the member's terms (it's the card text).
  pitch: string
  defaultOwner: string // office
  defaultAudience: Audience[]
  defaultPricing: Pricing
  // Where the card goes when there's no college link: a built NextChapter
  // screen. Null means the college must give a link before members see it.
  builtIn: { path: string } | null
  // Which staff workspace runs it, for the "owned in" link.
  workspace?: WorkspaceKey
  // Campaigns run from staff workspaces; they have no member card.
  memberCard: boolean
  defaultOn: boolean
}

export const AUDIENCE_LABELS: Record<Audience, string> = {
  alumni: 'Alumni',
  students: 'Students',
  recent_grads: 'Recent grads',
  parents: 'Parents',
  // Alumni who told the college they've lost a job or are looking.
  in_transition: 'In transition',
}
export const PRICING_LABELS: Record<Pricing, string> = { free: 'Free', paid: 'Paid', donor: 'Donor-funded' }
export const OFFICES = ['Career Services', 'Alumni Relations', 'Development', 'Exec Ed', 'Library', 'Employer Relations', 'Admissions'] as const

export const SERVICE_GROUPS: { key: ServiceGroup; label: string; blurb: string }[] = [
  { key: 'core', label: 'Core services', blurb: 'What most colleges switch on first.' },
  { key: 'more', label: 'More you could offer', blurb: 'Add any of these when an office is ready to own it.' },
  { key: 'campaigns', label: 'Campaigns', blurb: 'Outreach your staff send on a schedule or a trigger. No member card.' },
]

const ALL: Audience[] = ['alumni', 'students', 'recent_grads', 'parents']
const GRADS: Audience[] = ['alumni', 'recent_grads']

export const SERVICES: Service[] = [
  // Core
  { key: 'career_services', group: 'core', name: 'Career services', pitch: 'A counselor, early-career check-ins and appointments, through five years after graduation.', defaultOwner: 'Career Services', defaultAudience: ['students', 'recent_grads'], defaultPricing: 'free', builtIn: { path: '/dashboard' }, workspace: 'career', memberCard: true, defaultOn: true },
  { key: 'coaching', group: 'core', name: 'Coaching', pitch: 'One-to-one coaching from your college’s coaches and NextChapter’s. Free while you’re in transition.', defaultOwner: 'Career Services', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/dashboard/coaching-match' }, workspace: 'career', memberCard: true, defaultOn: true },
  { key: 'alumni_network', group: 'core', name: 'Alumni network', pitch: 'Mentors who’ll take a call, warm introductions, and jobs at companies where alumni work.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/dashboard/network' }, workspace: 'alumni', memberCard: true, defaultOn: true },
  { key: 'alumni_job_board', group: 'core', name: 'Alumni job board', pitch: 'Roles posted for your college’s alumni, ranked first, with who to ask.', defaultOwner: 'Career Services', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/dashboard/alumni-jobs' }, workspace: 'career', memberCard: true, defaultOn: true },
  { key: 'free_retraining', group: 'core', name: 'Free retraining courses', pitch: 'Short courses your college offers alumni at no charge.', defaultOwner: 'Exec Ed', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/dashboard/learning' }, workspace: 'execed', memberCard: true, defaultOn: false },
  { key: 'digital_resources', group: 'core', name: 'Digital resources', pitch: 'Research databases and learning libraries your college licenses for alumni.', defaultOwner: 'Library', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'donations', group: 'core', name: 'Give back', pitch: 'Fund coaching and retraining for the next alum who needs it.', defaultOwner: 'Development', defaultAudience: ['alumni', 'parents'], defaultPricing: 'donor', builtIn: null, workspace: 'development', memberCard: true, defaultOn: true },
  { key: 'events', group: 'core', name: 'Events and webinars', pitch: 'Career panels, employer nights and layoff-response sessions.', defaultOwner: 'Alumni Relations', defaultAudience: ALL, defaultPricing: 'free', builtIn: { path: '/dashboard/webinars' }, workspace: 'alumni', memberCard: true, defaultOn: false },
  { key: 'exec_ed', group: 'core', name: 'Executive education', pitch: 'Paid programs and certificates, suggested when they close a gap in your search.', defaultOwner: 'Exec Ed', defaultAudience: GRADS, defaultPricing: 'paid', builtIn: null, workspace: 'execed', memberCard: true, defaultOn: false },
  { key: 'employer_packages', group: 'core', name: 'Employer packages', pitch: 'Branded pages and priority posts for employers hiring your graduates.', defaultOwner: 'Employer Relations', defaultAudience: [], defaultPricing: 'paid', builtIn: null, workspace: 'career', memberCard: false, defaultOn: false },
  { key: 'family_access', group: 'core', name: 'Parent and spouse access', pitch: 'The full toolkit for a parent or partner in a job change.', defaultOwner: 'Alumni Relations', defaultAudience: ['parents'], defaultPricing: 'paid', builtIn: { path: '/dashboard' }, memberCard: true, defaultOn: false },

  // More
  { key: 'reviews', group: 'more', name: 'Résumé, LinkedIn and mock interviews', pitch: 'An AI first pass, then a person.', defaultOwner: 'Career Services', defaultAudience: ALL, defaultPricing: 'free', builtIn: { path: '/dashboard/interview-prep' }, memberCard: true, defaultOn: false },
  { key: 'hardship_fund', group: 'more', name: 'Emergency assistance', pitch: 'A donor-funded hardship grant for alumni in a layoff.', defaultOwner: 'Development', defaultAudience: GRADS, defaultPricing: 'donor', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'business_directory', group: 'more', name: 'Alumni business directory', pitch: 'Alumni hire alumni for projects and fractional work.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'encore', group: 'more', name: 'Encore and career-change tracks', pitch: 'For a second career, board service or fractional work after 55.', defaultOwner: 'Alumni Relations', defaultAudience: ['alumni'], defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'mentoring_circles', group: 'more', name: 'Mentoring circles', pitch: 'Small industry groups that meet monthly and keep each other moving.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'board_matching', group: 'more', name: 'Board and advisory matching', pitch: 'Nonprofit boards, advisory and speaking roles.', defaultOwner: 'Alumni Relations', defaultAudience: ['alumni'], defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'entrepreneur_support', group: 'more', name: 'Entrepreneur support', pitch: 'Founder office hours, pitch events and small grants.', defaultOwner: 'Alumni Relations', defaultAudience: ALL, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'credentials', group: 'more', name: 'Transcripts and badges', pitch: 'Send verified records to an employer.', defaultOwner: 'Career Services', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'alumni_discounts', group: 'more', name: 'Alumni discounts', pitch: 'Continuing-ed tuition, graduate programs and campus perks.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'email_forwarding', group: 'more', name: 'Lifelong email', pitch: 'Keep your college address forwarding for life.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'relocation', group: 'more', name: 'Relocation help', pitch: 'Chapter hosts and city guides when a job moves you.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'outcomes_survey', group: 'more', name: 'First-destination survey', pitch: 'Tell your college where you landed; it counts toward its outcomes.', defaultOwner: 'Career Services', defaultAudience: ['recent_grads'], defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },

  // Campaigns
  { key: 'annual_checkin', group: 'campaigns', name: 'Annual career check-in', pitch: 'Once a year, every alum gets two questions: "How’s work?" and "Want help?"', defaultOwner: 'Alumni Relations', defaultAudience: ['alumni'], defaultPricing: 'free', builtIn: null, workspace: 'alumni', memberCard: false, defaultOn: true },
  { key: 'grad_checkins', group: 'campaigns', name: 'Early-career check-ins', pitch: 'Automatic check-ins 6, 18 and 24 months after graduation; "looking" alerts the counselor.', defaultOwner: 'Career Services', defaultAudience: ['recent_grads'], defaultPricing: 'free', builtIn: null, workspace: 'career', memberCard: false, defaultOn: true },
  { key: 'layoff_outreach', group: 'campaigns', name: 'Layoff outreach', pitch: '"If you’re affected, we have your back," when a WARN notice hits an alum’s employer.', defaultOwner: 'Alumni Relations', defaultAudience: ['alumni'], defaultPricing: 'free', builtIn: null, workspace: 'alumni', memberCard: false, defaultOn: true },
]

// Who delivers it: the college's own (its link, its staff), NextChapter's
// built-in screen, or both (the college's link first, NextChapter's too).
export type Provider = 'college' | 'nextchapter' | 'both'
export const PROVIDER_LABELS: Record<Provider, string> = { college: 'Your college', nextchapter: 'NextChapter', both: 'Both' }

export type ServiceSetting = {
  provider: Provider
  on: boolean
  audience: Audience[]
  ownerOffice: string
  ownerName: string | null
  pricing: Pricing
  linkUrl: string | null
}

export function getService(key: string): Service | undefined {
  return SERVICES.find((s) => s.key === key)
}

export function defaultSetting(s: Service): ServiceSetting {
  return { provider: s.builtIn ? 'nextchapter' : 'college', on: s.defaultOn, audience: s.defaultAudience, ownerOffice: s.defaultOwner, ownerName: null, pricing: s.defaultPricing, linkUrl: null }
}

// Stored choices merged over each service's defaults; unknown keys dropped.
export function serviceSettingsFrom(enabledFeatures: unknown): Record<string, ServiceSetting> {
  const stored = ((enabledFeatures as { services?: Record<string, Partial<ServiceSetting>> } | null)?.services ?? {}) as Record<
    string,
    Partial<ServiceSetting>
  >
  return Object.fromEntries(
    SERVICES.map((s) => {
      const merged = { ...defaultSetting(s), ...(stored[s.key] ?? {}) }
      // Saved before providers existed: a link meant the college's own.
      if (!stored[s.key]?.provider && merged.linkUrl) merged.provider = s.builtIn ? 'both' : 'college'
      if (!s.builtIn) merged.provider = 'college'
      return [s.key, merged]
    }),
  )
}

export function checkInMonthFrom(enabledFeatures: unknown): number {
  const month = (enabledFeatures as { checkIns?: { annualMonth?: number } } | null)?.checkIns?.annualMonth
  return month && month >= 1 && month <= 12 ? month : 9
}

// Where a member's card goes: the college's link if it gave one, else the
// built NextChapter screen. Null = not openable yet (hidden from members).
export function serviceTarget(s: Service, setting: ServiceSetting): string | null {
  if (setting.provider === 'college') return setting.linkUrl || null
  if (setting.provider === 'nextchapter') return s.builtIn?.path ?? null
  return setting.linkUrl || s.builtIn?.path || null
}

// Which audiences a member falls in. Recent grad = graduated in the last 5
// years (Career Services' window in the product design).
export function memberAudiences(m: { affiliation: string; classYear: number | null }, now = new Date(), inTransition = false): Audience[] {
  if (m.affiliation === 'PARENT') return ['parents']
  if (m.affiliation === 'STUDENT') return ['students']
  const recent = m.classYear !== null && m.classYear >= now.getUTCFullYear() - 5
  return [...(recent ? (['alumni', 'recent_grads'] as Audience[]) : (['alumni'] as Audience[])), ...(inTransition ? (['in_transition'] as Audience[]) : [])]
}

// The cards a member sees: on, has a member card, has somewhere to go, and is
// for one of their audiences. A preview with no member record sees all.
export function memberCards(settings: Record<string, ServiceSetting>, audiences: Audience[] | null): Service[] {
  return SERVICES.filter((s) => {
    const st = settings[s.key]
    if (!st?.on || !s.memberCard || !serviceTarget(s, st)) return false
    return audiences === null || st.audience.some((a) => audiences.includes(a))
  })
}

// Exec Ed's starting catalog (product design examples). Programs, cohorts and
// enrollment are V2; these are what a college can put on its plan now.
export const PROGRAM_IDEAS: { key: string; name: string; summary: string; audience: string; examples?: { name: string; institution: string; url: string }[] }[] = [
  {
    key: 'ai_ready',
    name: 'AI-Ready Professional Certificate',
    summary: 'Six weeks of practical generative AI for working professionals, with tracks such as AI-enabled project management.',
    audience: 'Mid-career alumni and local employers',
    examples: [
      { name: 'GenAI 101 (free, self-paced, opened to alumni first)', institution: 'Indiana University Kelley School of Business', url: 'https://blog.kelley.iu.edu/2026/04/16/iu-opens-free-generative-ai-course-to-anyone-worldwide-class-presented-by-kelley-school/' },
      { name: 'Free AI microcredential for alumni', institution: 'Purdue University', url: 'https://www.purdue.edu/newsroom/purduetoday/2025/Q4/purdue-expands-free-online-ai-and-high-demand-technical-skill-courses-to-alumni/' },
    ],
  },
  {
    key: 'ai_leaders',
    name: 'Leading teams through AI',
    summary: 'For managers and executives: choosing use cases, redesigning roles, governance.',
    audience: 'Senior alumni',
    examples: [{ name: 'Artificial Intelligence executive education', institution: 'Carnegie Mellon School of Computer Science', url: 'https://execonline.cs.cmu.edu/introduction-artificial-intelligence' }],
  },
  { key: 'data_analytics', name: 'Data analytics certificate', summary: 'SQL, spreadsheets and dashboards, with a capstone on a local employer’s data.', audience: 'Alumni and adult learners' },
  { key: 'regional_reskilling', name: 'Regional industry reskilling', summary: 'Short programs for the region’s largest employers, built with the local workforce board; WIOA-fundable once on the state’s approved list.', audience: 'Dislocated workers and alumni' },
]
