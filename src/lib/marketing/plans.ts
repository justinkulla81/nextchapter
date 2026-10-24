// The plans NextChapter offers, in one place. Names and what each includes,
// never amounts: the website shows plans, not prices (owner decision
// 2026-10-23, docs/specs/plans-and-pricing-structure.md). Portal pages can
// reuse this file. src/test/plans-data.test.ts keeps amounts and cost words
// out of every string here.

export type PlanFamily = 'individual' | 'organization' | 'corporate'

/** The seven partner portals. Each has its own page, its own plans and, where one exists, a free plan listed first. */
export type PortalKey = 'higher_education' | 'workforce' | 'hiring' | 'employees' | 'outplacement' | 'recruiters' | 'coaches'

export interface PlanCta {
  label: string
  href: string
}

export interface Plan {
  family: PlanFamily
  /** Stable key. Individual keys match PlanCatalogEntry keys where one exists. */
  planKey: string
  name: string
  audience: string
  includes: string[]
  addOns: string[]
  cta: PlanCta
  /** The portal this plan belongs to. Individual plans and the enterprise bundle have none. */
  portal?: PortalKey
  /** True only for a plan that costs the buyer nothing today. Free plans are listed first in their portal. */
  free?: boolean
}

export interface PortalPlanLabel {
  title: string
  blurb: string
  /** The portal's own page, which shows the same plans. */
  href: string
}

/** Portals in the order the plans page lists them. */
export const PORTAL_ORDER: PortalKey[] = ['higher_education', 'workforce', 'hiring', 'employees', 'outplacement', 'recruiters', 'coaches']

export const PORTAL_PLAN_LABELS: Record<PortalKey, PortalPlanLabel> = {
  higher_education: { title: 'Higher education', blurb: 'Career services, alumni relations, development, executive education and administration.', href: '/higher-education' },
  workforce: { title: 'Workforce and economic development', blurb: 'Workforce boards, economic development organizations and chambers.', href: '/government-workforce' },
  hiring: { title: 'Hiring', blurb: 'Employers hiring future employees.', href: '/talent' },
  employees: { title: 'Employees', blurb: 'Employers developing and keeping current employees.', href: '/employees' },
  outplacement: { title: 'Outplacement', blurb: 'Employers supporting departing employees. Set up by contract.', href: '/outplacement' },
  recruiters: { title: 'Recruiters', blurb: 'Search firms, agencies and in-house recruiters. Free for now.', href: '/recruiters' },
  coaches: { title: 'Coaches', blurb: 'Independent coaches and coaching practices. Free for now.', href: '/coaches' },
}

export const FAMILY_LABELS: Record<PlanFamily, { title: string; blurb: string }> = {
  individual: { title: 'Individual', blurb: 'For a candidate. Free to start, with optional membership and coaching.' },
  organization: { title: 'Organizations and professionals', blurb: 'For colleges, workforce organizations, recruiters and coaches.' },
  corporate: { title: 'Corporate', blurb: 'For employers, by stage of the employee lifecycle.' },
}

export const TALK_TO_US: PlanCta = { label: 'Talk to us', href: '/for-organizations#contact' }
const talkTo = (route: string): PlanCta => ({ label: 'Talk to us', href: `${route}#talk` })
const START_FREE: PlanCta = { label: 'Start free', href: '/dashboard' }

export const PLANS: Plan[] = [
  {
    family: 'individual',
    planKey: 'dtc_free',
    name: 'Free',
    audience: 'Every candidate',
    includes: [
      'Market Reality Report',
      'Resume Studio',
      'Networking and job application CRM',
      'Skills and personality assessment for better job matches',
      'Community and company pages',
    ],
    addOns: [],
    cta: START_FREE,
  },
  {
    family: 'individual',
    planKey: 'membership',
    name: 'Membership',
    audience: 'Candidates who have landed and want to stay ready',
    includes: [
      'Annual Dossier refresh',
      'Quarterly comp-benchmarked market check',
      'Benefits Network',
      'Board and advisory listings',
      'Priority coach booking',
      'Break-glass reactivation',
    ],
    addOns: [],
    cta: { label: 'See membership', href: '/membership' },
  },
  {
    family: 'individual',
    planKey: 'dtc_resume',
    name: 'Resume',
    audience: 'Candidates who want a human review',
    includes: ['Everything in Free', 'One human resume review', 'Unlimited versions', 'Per-job tailoring', 'Full ATS matrix'],
    addOns: [],
    cta: START_FREE,
  },
  {
    family: 'individual',
    planKey: 'dtc_coaching_plus',
    name: 'Coaching Plus',
    audience: 'Candidates who want a human coach',
    includes: ['One coaching session a month', 'Resume review included', 'Priority support'],
    addOns: [],
    cta: { label: 'See coaching', href: '/coaching' },
  },
  {
    family: 'individual',
    planKey: 'dtc_coaching_premium',
    name: 'Coaching Premium',
    audience: 'Candidates who want regular coaching',
    includes: ['Four coaching sessions a month', 'Mock interviews with recorded feedback', 'Negotiation support', 'Named coach'],
    addOns: [],
    cta: { label: 'See coaching', href: '/coaching' },
  },
  {
    family: 'individual',
    planKey: 'dtc_executive',
    name: 'Executive',
    audience: 'Senior candidates',
    includes: ['Everything in Coaching Premium', 'Named personal executive recruiter', 'Weekly strategy sessions'],
    addOns: [],
    cta: { label: 'See coaching', href: '/coaching' },
  },
  {
    family: 'organization',
    portal: 'higher_education',
    planKey: 'higher_ed_free',
    name: 'Free workspace',
    audience: 'Colleges and universities, after a verified claim',
    free: true,
    includes: [
      'Created when someone at your institution claims your page with a work email at your email domain',
      'Up to 50 active members',
      'Your own page on NextChapter',
      'Your own services listed for your members',
      'Basic counts of members and activity',
    ],
    addOns: [],
    cta: { label: 'Claim your page', href: '/higher-education#claim' },
  },
  {
    family: 'organization',
    portal: 'higher_education',
    planKey: 'higher_ed_paid',
    name: 'Institution plan',
    audience: 'Colleges and universities that need reporting at scale',
    includes: [
      'Everything in the free workspace',
      'Reporting and exports',
      'Exchange of records with your CRM',
      'More active members',
      'Staff roles',
      'An audit log of staff activity',
      'NextChapter coaching and courses offered to your members',
    ],
    addOns: ['AI training for career services'],
    cta: talkTo('/higher-education'),
  },
  {
    family: 'organization',
    portal: 'workforce',
    planKey: 'workforce_free',
    name: 'Free workspace',
    audience: 'Workforce boards, economic development organizations, chambers and community organizations, after a verified claim',
    free: true,
    includes: [
      'Created when someone at your organization claims your page with a work email at your email domain',
      'Up to 50 active members',
      'Your own page on NextChapter',
      'Your own services listed for the people you serve',
      'Basic counts of participants and activity',
    ],
    addOns: [],
    cta: { label: 'Claim your page', href: '/government-workforce#claim' },
  },
  {
    family: 'organization',
    portal: 'workforce',
    planKey: 'workforce_paid',
    name: 'Program plan',
    audience: 'Workforce organizations that need reporting at scale',
    includes: [
      'Everything in the free workspace',
      'Reporting and exports',
      'Exchange of records with your CRM',
      'More active members',
      'Staff roles',
      'An audit log of staff activity',
      'NextChapter coaching and courses offered to the people you serve',
      'Program reporting, scoped with you',
    ],
    addOns: ['AI training for career services'],
    cta: talkTo('/government-workforce'),
  },
  {
    family: 'corporate',
    portal: 'hiring',
    planKey: 'corporate_hiring',
    name: 'Post a role',
    audience: 'Employers hiring',
    free: true,
    includes: ['Post a role free', 'Candidates matched on what they say they are looking for', 'An evidence brief for each candidate who chose to be seen'],
    addOns: [],
    cta: { label: 'Post a role', href: '/talent/signup' },
  },
  {
    family: 'corporate',
    portal: 'hiring',
    planKey: 'corporate_hiring_team',
    name: 'Hiring team',
    audience: 'Employers with a hiring team',
    includes: ['Everything in Post a role', 'Seats for your hiring team', 'Hiring analytics', 'Candidate export'],
    addOns: [],
    cta: talkTo('/talent'),
  },
  {
    family: 'corporate',
    portal: 'employees',
    planKey: 'corporate_employees',
    name: 'Employees',
    audience: 'Employers developing and keeping current employees',
    includes: [
      'Retention: promotion and raise preparation, internal roles and paths into new functions',
      'Learning and development: a skills plan for each person, starting with the courses you cover',
      'Job retraining for people whose jobs are changing: not available yet',
      'Counts by team, never by person',
    ],
    addOns: ['NextChapter courses and AI skills training for your people'],
    cta: talkTo('/employees'),
  },
  {
    family: 'corporate',
    portal: 'outplacement',
    planKey: 'outplacement_core',
    name: 'Outplacement Core',
    audience: 'Employers with departing employees',
    includes: [
      '6-month term',
      'Resume Studio and ATS matrix',
      'Full Executive Dossier',
      'Standard recruiter introductions',
      'Basic Market Intelligence',
      'Interim and fractional boards and playbook',
    ],
    addOns: [],
    cta: talkTo('/outplacement'),
  },
  {
    family: 'corporate',
    portal: 'outplacement',
    planKey: 'outplacement_plus',
    name: 'Outplacement Plus',
    audience: 'Employers with departing employees',
    includes: [
      '6-month term',
      'Six coaching sessions',
      'One human resume review',
      'Full Executive Dossier',
      'Standard recruiter introductions',
      'Standard Market Intelligence',
      'Curated interim and fractional openings',
    ],
    addOns: [],
    cta: talkTo('/outplacement'),
  },
  {
    family: 'corporate',
    portal: 'outplacement',
    planKey: 'outplacement_premium',
    name: 'Outplacement Premium',
    audience: 'Employers with departing employees',
    includes: [
      '12-month term',
      'Twelve coaching sessions with a named coach and 48-hour response',
      'Unlimited resume reviews and versions',
      'Full Executive Dossier',
      'Dedicated recruiter relationship',
      'Full Market Intelligence',
      'Private cohort space and coworking stipend',
      'Board search, fractional CRO/CFO track and advisory placement',
    ],
    addOns: [],
    cta: talkTo('/outplacement'),
  },
  {
    family: 'organization',
    portal: 'recruiters',
    planKey: 'recruiter_workspace',
    name: 'Recruiter workspace',
    audience: 'Recruiters, search firms and in-house recruiters',
    free: true,
    includes: [
      'Search candidates who opted in to be found',
      'A submission packet in your firm’s logo, built from the candidate’s Dossier',
      'A résumé intake page in your firm’s logo',
      'Submission stages from reviewed to placed',
    ],
    addOns: [],
    cta: { label: 'Get access', href: '/recruiters/signup' },
  },
  {
    family: 'organization',
    portal: 'coaches',
    planKey: 'coach_workspace',
    name: 'Coach workspace',
    audience: 'Independent coaches and coaching practices',
    free: true,
    includes: [
      'Invite clients with a code',
      'See the plan, applications and progress each client chooses to share',
      'A prep page before each session',
      'Session notes and follow-ups',
      'Your practice name and logo on the tools your clients see',
    ],
    addOns: [],
    cta: { label: 'Set up your account', href: '/support/coach/signup' },
  },
  {
    family: 'corporate',
    planKey: 'corporate_enterprise',
    name: 'Enterprise bundle',
    audience: 'Employers who want Hiring, Employees and Outplacement together',
    includes: ['All three sections under one contract'],
    addOns: [],
    cta: TALK_TO_US,
  },
]

export function plansForFamily(family: PlanFamily): Plan[] {
  return PLANS.filter((p) => p.family === family)
}

export function plansForPortal(portal: PortalKey): Plan[] {
  return PLANS.filter((p) => p.portal === portal)
}

/** Plans that belong to no single portal: the enterprise bundle. */
export function plansAcrossPortals(): Plan[] {
  return PLANS.filter((p) => p.family === 'corporate' && !p.portal)
}
