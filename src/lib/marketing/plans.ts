// The plans NextChapter offers, in one place. Names and what each includes,
// never amounts: the website shows plans, not prices (owner decision
// 2026-10-23, docs/specs/plans-and-pricing-structure.md). Portal pages can
// reuse this file. src/test/plans-data.test.ts keeps amounts and cost words
// out of every string here.

export type PlanFamily = 'individual' | 'organization' | 'corporate'

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
}

export const FAMILY_LABELS: Record<PlanFamily, { title: string; blurb: string }> = {
  individual: { title: 'Individual', blurb: 'For a candidate. Free to start, with optional membership and coaching.' },
  organization: { title: 'Organization', blurb: 'For colleges, workforce agencies and nonprofits serving job seekers.' },
  corporate: { title: 'Corporate', blurb: 'For employers, by stage of the employee lifecycle.' },
}

export const TALK_TO_US: PlanCta = { label: 'Talk to us', href: '/for-organizations#contact' }
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
    planKey: 'organization',
    name: 'Organization',
    audience: 'Colleges, workforce agencies, chambers and nonprofits',
    includes: [
      'Every jobseeker you serve gets NextChapter free',
      'Exportable participant progress',
      'Self-reported placement counts',
      'Built to sit alongside WIOA systems of record',
    ],
    // TODO(free-workspace): add after claim + entitlements ship
    // (free workspace for a verified claim, its own page and services listed).
    addOns: ['AI training for career services', 'Coaching sessions for members'],
    cta: TALK_TO_US,
  },
  {
    family: 'corporate',
    planKey: 'corporate_hiring',
    name: 'Hiring',
    audience: 'Employers hiring',
    includes: ['Post a role free', 'Verified candidate profiles', 'Work-style fit signal'],
    addOns: [],
    cta: { label: 'Post a role', href: '/talent' },
  },
  {
    family: 'corporate',
    planKey: 'corporate_employees',
    name: 'Employees',
    audience: 'Employers supporting current employees',
    includes: ['Programs for current employees, chosen with you'],
    addOns: [],
    cta: TALK_TO_US,
  },
  {
    family: 'corporate',
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
    cta: TALK_TO_US,
  },
  {
    family: 'corporate',
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
    cta: TALK_TO_US,
  },
  {
    family: 'corporate',
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
    cta: TALK_TO_US,
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
