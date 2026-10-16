// The service menu a college switches on (product design, "Service menu:
// what a college can switch on"). One catalog; each college's choices live in
// Institution.enabledFeatures.services. Turning a service on puts its card on
// the Candidate home for the audiences picked, and every card open is counted
// (AnalyticsEvent `he_service_opened`), which is the usage shown to staff.
//
// Data, not code paths: adding a service is an entry here.

import type { OrgKind, WorkspaceKey } from './workspaces'

export type Audience = 'alumni' | 'students' | 'recent_grads' | 'parents' | 'in_transition' | 'job_seekers'
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
  // A workforce customer's participants.
  job_seekers: 'Job seekers',
}
export const PRICING_LABELS: Record<Pricing, string> = { free: 'Free', paid: 'Paid', donor: 'Donor-funded' }
export const OFFICES = ['Career Services', 'Alumni Relations', 'Development', 'Exec Ed', 'Library', 'Employer Relations', 'Admissions'] as const

export const SERVICE_GROUPS: { key: ServiceGroup; label: string; blurb: string }[] = [
  { key: 'core', label: 'Core services', blurb: 'What most organizations switch on first.' },
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
  { key: 'business_directory', group: 'more', name: 'Alumni projects and board seats', pitch: 'Alumni hire alumni for short projects, fractional roles and board seats.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/i/{slug}/candidate/jobs#projects-h' }, workspace: 'alumni', memberCard: true, defaultOn: false },
  { key: 'career_pivots', group: 'more', name: 'Career pivot paths', pitch: 'Where people with your background moved next, the skills each move takes, and alumni who made it.', defaultOwner: 'Career Services', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/dashboard/pivot-paths' }, workspace: 'career', memberCard: true, defaultOn: false },
  { key: 'learning_communities', group: 'more', name: 'Learning communities', pitch: 'Small groups that learn a skill together or job-search together, week by week.', defaultOwner: 'Alumni Relations', defaultAudience: ALL, defaultPricing: 'free', builtIn: { path: '/dashboard/community' }, workspace: 'alumni', memberCard: true, defaultOn: false },
  { key: 'course_auditing', group: 'more', name: 'Audit a course', pitch: 'Sit in on a regular course, no grade, no tuition.', defaultOwner: 'Exec Ed', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/i/{slug}/candidate/programs#audit-h' }, workspace: 'teaching', memberCard: true, defaultOn: false },
  { key: 'financial_wellness', group: 'more', name: 'Money help in a job change', pitch: 'Unemployment, COBRA, severance and a budget to bridge the gap.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: { path: '/dashboard/benefits' }, memberCard: true, defaultOn: false },
  { key: 'wellbeing', group: 'more', name: 'Counseling and wellbeing', pitch: 'Support for the stress of a job loss or a hard search.', defaultOwner: 'Alumni Relations', defaultAudience: ALL, defaultPricing: 'free', builtIn: { path: '/dashboard/support' }, memberCard: true, defaultOn: false },
  { key: 'legal_clinic', group: 'more', name: 'Alumni legal clinic', pitch: 'A short consult on a severance agreement or a non-compete, from alumni lawyers.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'health_insurance', group: 'more', name: 'Alumni health and life insurance', pitch: 'Group plans through the alumni association, for gaps between jobs.', defaultOwner: 'Alumni Relations', defaultAudience: GRADS, defaultPricing: 'paid', builtIn: null, memberCard: true, defaultOn: false },
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

// A workforce customer's menu (board, economic development org, chamber):
// what it can switch on for the job seekers it serves.
const SEEKERS: Audience[] = ['job_seekers']
export const WORKFORCE_SERVICES: Service[] = [
  { key: 'coaching', group: 'core', name: 'Coaching', pitch: 'One-to-one coaching from NextChapter’s coaches and your local career center’s.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/coaching-match' }, workspace: 'hub', memberCard: true, defaultOn: true },
  { key: 'local_jobs', group: 'core', name: 'Local jobs first', pitch: 'Jobs near you ranked first, matched to your skills, with who to ask.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/find-my-job' }, workspace: 'hub', memberCard: true, defaultOn: true },
  { key: 'training', group: 'core', name: 'Training and AI courses', pitch: 'Short courses and certificates, often free with WIOA funding.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/i/{slug}/candidate/programs' }, workspace: 'execed', memberCard: true, defaultOn: true },
  { key: 'reviews', group: 'core', name: 'Résumé, LinkedIn and mock interviews', pitch: 'An AI first pass, then a person.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/interview-prep' }, memberCard: true, defaultOn: true },
  { key: 'financial_wellness', group: 'core', name: 'Money help in a job change', pitch: 'Unemployment, COBRA, severance and a budget to bridge the gap.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/benefits' }, memberCard: true, defaultOn: true },
  { key: 'career_center', group: 'core', name: 'Your local career center', pitch: 'In-person help, workshops and training funding at your American Job Center.', defaultOwner: 'Career center', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'career_pivots', group: 'more', name: 'Career pivot paths', pitch: 'Where people with your background moved next, and the skills each move takes.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/pivot-paths' }, memberCard: true, defaultOn: false },
  { key: 'learning_communities', group: 'more', name: 'Job-search groups', pitch: 'Small groups that job-search or learn a skill together, week by week.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/community' }, memberCard: true, defaultOn: false },
  { key: 'events', group: 'more', name: 'Hiring events and webinars', pitch: 'Employer nights, job fairs and layoff-response sessions.', defaultOwner: 'Business services', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/webinars' }, memberCard: true, defaultOn: false },
  { key: 'wellbeing', group: 'more', name: 'Counseling and wellbeing', pitch: 'Support for the stress of a job loss or a hard search.', defaultOwner: 'Program team', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: { path: '/dashboard/support' }, memberCard: true, defaultOn: false },
  { key: 'fractional', group: 'more', name: 'Project and fractional work', pitch: 'Paid short projects with local small businesses while you search.', defaultOwner: 'Business services', defaultAudience: SEEKERS, defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: false },
  { key: 'layoff_seats', group: 'campaigns', name: 'Layoff seats', pitch: 'When a member company has a layoff, its people get seats and a sign-up page.', defaultOwner: 'Business services', defaultAudience: [], defaultPricing: 'free', builtIn: null, workspace: 'hub', memberCard: false, defaultOn: true },
]

export function servicesFor(kind: OrgKind = 'college'): Service[] {
  return kind === 'workforce' ? WORKFORCE_SERVICES : SERVICES
}

export function officesFor(kind: OrgKind = 'college'): readonly string[] {
  return kind === 'workforce' ? ['Program team', 'Business services', 'Career center', 'Partner'] : OFFICES
}

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

export function getService(key: string, kind: OrgKind = 'college'): Service | undefined {
  return servicesFor(kind).find((s) => s.key === key)
}

export function defaultSetting(s: Service): ServiceSetting {
  return { provider: s.builtIn ? 'nextchapter' : 'college', on: s.defaultOn, audience: s.defaultAudience, ownerOffice: s.defaultOwner, ownerName: null, pricing: s.defaultPricing, linkUrl: null }
}

// Stored choices merged over each service's defaults; unknown keys dropped.
export function serviceSettingsFrom(enabledFeatures: unknown, kind: OrgKind = 'college'): Record<string, ServiceSetting> {
  const stored = ((enabledFeatures as { services?: Record<string, Partial<ServiceSetting>> } | null)?.services ?? {}) as Record<
    string,
    Partial<ServiceSetting>
  >
  return Object.fromEntries(
    servicesFor(kind).map((s) => {
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
  if (m.affiliation === 'PARTICIPANT' || m.affiliation === 'LEARNER') return ['job_seekers', ...(inTransition ? (['in_transition'] as Audience[]) : [])]
  if (m.affiliation === 'STUDENT') return ['students']
  const recent = m.classYear !== null && m.classYear >= now.getUTCFullYear() - 5
  return [...(recent ? (['alumni', 'recent_grads'] as Audience[]) : (['alumni'] as Audience[])), ...(inTransition ? (['in_transition'] as Audience[]) : [])]
}

// The cards a member sees: on, has a member card, has somewhere to go, and is
// for one of their audiences. A preview with no member record sees all.
export function memberCards(settings: Record<string, ServiceSetting>, audiences: Audience[] | null, kind: OrgKind = 'college'): Service[] {
  return servicesFor(kind).filter((s) => {
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
