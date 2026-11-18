// The Education Hub's sample catalog for a workforce demo (owner, 2026-11-18: the demo shows the Education Hub filled in).
// Sample providers only (no real school or company is named), every source represented, some training assigned to a group and
// some listed for anyone, so Catalog, Assign and Gaps and coverage all have something to show. Removed with the demo (cascade).

type Row = {
  source: 'UNIVERSITY' | 'THIRD_PARTY' | 'LOCAL'
  title: string
  provider: string
  summary: string
  skills: string[]
  industries: string[]
  functions: string[]
  levels: string[]
  hours: number | null
  priceCents: number
  wioaEligible: boolean
  ncCustom: boolean
  assignment: 'LISTED' | 'ASSIGNED'
}

const ROWS = (city: string): Row[] => [
  {
    source: 'UNIVERSITY',
    title: 'Certificate in project management',
    provider: `${city} area community college (sample)`,
    summary: 'Evening certificate: planning, budgets, risk and leading a team through delivery. Prepares for the CAPM exam.',
    skills: ['Project management', 'Budgeting', 'Risk management'],
    industries: [],
    functions: ['Operations', 'Engineering'],
    levels: ['Individual contributor', 'Manager'],
    hours: 90,
    priceCents: 240000,
    wioaEligible: true,
    ncCustom: false,
    assignment: 'ASSIGNED',
  },
  {
    source: 'UNIVERSITY',
    title: 'Healthcare administration certificate',
    provider: `${city} regional university (sample)`,
    summary: 'For people moving into hospital and clinic operations: revenue cycle, compliance and scheduling.',
    skills: ['Revenue cycle', 'Healthcare compliance', 'Scheduling'],
    industries: ['Healthcare & Hospital Systems'],
    functions: ['Administration', 'Operations'],
    levels: [],
    hours: 120,
    priceCents: 380000,
    wioaEligible: true,
    ncCustom: false,
    assignment: 'ASSIGNED',
  },
  {
    source: 'UNIVERSITY',
    title: 'Executive leadership program',
    provider: `${city} regional university (sample)`,
    summary: 'Six weekends on strategy, finance for non-finance leaders and leading change.',
    skills: ['Strategy', 'Change management', 'Finance for leaders'],
    industries: [],
    functions: [],
    levels: ['Director or above'],
    hours: 48,
    priceCents: 650000,
    wioaEligible: false,
    ncCustom: false,
    assignment: 'LISTED',
  },
  {
    source: 'THIRD_PARTY',
    title: 'Data analytics with spreadsheets and SQL',
    provider: 'Online course provider (sample)',
    summary: 'Self-paced: cleaning data, pivot tables, SQL queries and a dashboard you can show an employer.',
    skills: ['SQL', 'Excel', 'Data visualization'],
    industries: [],
    functions: ['Finance', 'Operations', 'Data & Analytics', 'Marketing'],
    levels: ['Individual contributor'],
    hours: 60,
    priceCents: 29900,
    wioaEligible: false,
    ncCustom: false,
    assignment: 'ASSIGNED',
  },
  {
    source: 'THIRD_PARTY',
    title: 'Supply chain and logistics fundamentals',
    provider: 'Professional association (sample)',
    summary: 'Planning, inventory and transportation basics, with a certificate from a professional body.',
    skills: ['Inventory management', 'Demand planning', 'Logistics'],
    industries: ['Transportation & Logistics', 'Manufacturing & Industrial'],
    functions: ['Operations'],
    levels: [],
    hours: 40,
    priceCents: 89500,
    wioaEligible: true,
    ncCustom: false,
    assignment: 'LISTED',
  },
  {
    source: 'THIRD_PARTY',
    title: 'Customer success management',
    provider: 'Online course provider (sample)',
    summary: 'Onboarding, renewals and account health for people moving from support or sales into customer success.',
    skills: ['Account management', 'Customer onboarding', 'Renewals'],
    industries: ['Technology & Software'],
    functions: ['Customer Success', 'Sales'],
    levels: ['Individual contributor', 'Manager'],
    hours: 25,
    priceCents: 19900,
    wioaEligible: false,
    ncCustom: false,
    assignment: 'LISTED',
  },
  {
    source: 'LOCAL',
    title: 'AI tools for your job',
    provider: 'Built by NextChapter for this region (sample)',
    summary: 'Four short sessions on using AI assistants for writing, analysis and research in the work people already do.',
    skills: ['AI tools', 'Prompt writing', 'Research'],
    industries: [],
    functions: [],
    levels: [],
    hours: 6,
    priceCents: 0,
    wioaEligible: false,
    ncCustom: true,
    assignment: 'ASSIGNED',
  },
  {
    source: 'LOCAL',
    title: 'Job search bootcamp',
    provider: `${city} job center (sample)`,
    summary: 'Two weeks: résumé, LinkedIn, interviewing and a weekly search plan, run by the region’s own career coaches.',
    skills: ['Interviewing', 'Résumé writing', 'Networking'],
    industries: [],
    functions: [],
    levels: [],
    hours: 16,
    priceCents: 0,
    wioaEligible: true,
    ncCustom: false,
    assignment: 'LISTED',
  },
]

export function demoTrainingOfferings(institutionId: string, city: string) {
  return ROWS(city).map((r) => ({ institutionId, ...r, createdBy: 'demo' }))
}
