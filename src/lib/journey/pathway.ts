// "What would it take?" for a move into another function: what you already have,
// what you need, what it costs, how long it takes, what is hard about it, and, when
// we know why the member likes it, other ways to get what they are after. Pure and
// client-safe. Without the O*NET data this works from a curated profile of each
// function; where the Pivot Tool has loaded skill-level data it sits beside this.
//
// Costs are typical ranges to plan with, not quotes. We say so wherever they show.
// We inform and never block: "worth knowing" notes are honest, and the member decides.

import { assessPivot, pivotTier, type PivotFeasibility, type PivotTier } from './feasibility'

export type FunctionProfile = {
  coreSkills: string[]
  tools: string[]
  // What an employer in this function wants to see before they take a chance on a newcomer.
  proof: string
  challenges: string[]
  entryRoles: string[]
  // Typical USD ranges.
  cost: { informal: [number, number]; formal: [number, number]; formalWhat: string }
}

export const FUNCTION_PROFILES: Record<string, FunctionProfile> = {
  Operations: {
    coreSkills: ['process improvement', 'project management', 'vendor management', 'budgeting', 'metrics and reporting', 'change management'],
    tools: ['Excel', 'a project tool such as Asana or Jira', 'a BI dashboard'],
    proof: 'A process you improved, with before and after numbers',
    challenges: ['Operations roles vary a lot by industry, so the domain matters', 'Managing people without direct authority', 'Hiring managers often prefer someone from their own industry'],
    entryRoles: ['Operations manager', 'Business operations analyst'],
    cost: { informal: [0, 800], formal: [1500, 6000], formalWhat: 'a project management or Lean Six Sigma certification' },
  },
  Marketing: {
    coreSkills: ['positioning and messaging', 'campaign planning', 'analytics', 'content', 'channel management', 'budget ownership'],
    tools: ['an analytics tool', 'an email or CRM platform', 'an ads manager'],
    proof: 'A campaign you ran, with the result it produced',
    challenges: ['Results are public, so a portfolio matters', 'Agency and in-house roles reward different skills', 'Entry roles can pay well below senior roles in other functions'],
    entryRoles: ['Marketing manager', 'Marketing operations or analytics'],
    cost: { informal: [0, 1000], formal: [1000, 6000], formalWhat: 'a digital marketing certificate' },
  },
  Finance: {
    coreSkills: ['financial modeling', 'forecasting and budgeting', 'accounting fundamentals', 'reporting', 'controls', 'business partnering'],
    tools: ['Excel at an advanced level', 'an ERP such as NetSuite or SAP', 'a BI tool'],
    proof: 'A model or analysis a decision was made from',
    challenges: ['Credentials such as CPA, CFA or CMA are often expected for senior roles', 'Employers screen on prior finance titles', 'Accuracy standards are high'],
    entryRoles: ['Financial analyst', 'FP&A analyst'],
    cost: { informal: [0, 1500], formal: [1500, 8000], formalWhat: 'a finance certification such as CMA or the CFA program' },
  },
  Sales: {
    coreSkills: ['prospecting', 'discovery and qualifying', 'negotiation', 'pipeline management', 'presenting', 'resilience with rejection'],
    tools: ['a CRM such as Salesforce or HubSpot', 'a sales engagement tool'],
    proof: 'A quota you carried, or a deal you closed',
    challenges: ['Pay is often tied to quota, so income can swing', 'Employers want a track record of numbers', 'The first year is high pressure'],
    entryRoles: ['Account executive', 'Sales development or account manager'],
    cost: { informal: [0, 500], formal: [0, 3000], formalWhat: 'a sales training program (optional; most hiring is on results)' },
  },
  Engineering: {
    coreSkills: ['one programming language in depth', 'data structures and problem solving', 'version control', 'testing', 'system design basics', 'reading other people’s code'],
    tools: ['Git', 'a cloud platform', 'an editor and debugger'],
    proof: 'Projects you built and shipped, and code others reviewed',
    challenges: ['Technical interviews test skills that take months to prepare for', 'Employers filter on a degree or experience', 'You will likely start below your current level'],
    entryRoles: ['Software engineer (junior or mid)', 'QA or developer-in-test'],
    cost: { informal: [0, 1500], formal: [10000, 20000], formalWhat: 'a coding bootcamp, or a part-time degree at a much higher cost' },
  },
  Product: {
    coreSkills: ['customer discovery', 'prioritization', 'writing requirements', 'working with engineering', 'metrics', 'roadmapping'],
    tools: ['a roadmap or ticket tool such as Jira', 'a product analytics tool', 'a prototyping tool'],
    proof: 'A product or feature you shaped from problem to result',
    challenges: ['Few entry-level roles, and most are filled from inside', 'Influence without authority', 'Employers want shipped work, not courses'],
    entryRoles: ['Associate product manager', 'Product operations or technical program manager'],
    cost: { informal: [0, 1500], formal: [500, 6000], formalWhat: 'a product management certificate' },
  },
  Design: {
    coreSkills: ['visual design and layout', 'user research', 'interaction design', 'prototyping', 'critique and iteration', 'working with engineers'],
    tools: ['Figma', 'a prototyping tool', 'a research tool'],
    proof: 'A portfolio of three projects that show your process and results',
    challenges: ['Hiring is portfolio-first and the portfolio takes months to build', 'Entry-level design roles are competitive', 'You will likely start below your current level and pay'],
    entryRoles: ['Product or UX designer (junior)', 'Design operations or content design'],
    cost: { informal: [0, 1500], formal: [3000, 20000], formalWhat: 'a design bootcamp, certificate or part-time program' },
  },
  'Human Resources': {
    coreSkills: ['employee relations', 'recruiting', 'compensation and benefits basics', 'employment law basics', 'coaching managers', 'HR systems'],
    tools: ['an HRIS such as Workday', 'an applicant tracking system'],
    proof: 'A hiring, onboarding or policy program you ran',
    challenges: ['Employers often expect HR credentials', 'Compliance rules vary by state', 'Mostly partnering with leaders, so credibility matters'],
    entryRoles: ['HR generalist', 'Recruiter or people operations'],
    cost: { informal: [0, 800], formal: [500, 5000], formalWhat: 'an HR certification such as SHRM-CP or PHR' },
  },
  Administration: {
    coreSkills: ['scheduling and coordination', 'communication', 'office systems', 'budget tracking', 'discretion', 'vendor coordination'],
    tools: ['Microsoft 365 or Google Workspace', 'a travel and expense tool'],
    proof: 'References from leaders you supported',
    challenges: ['Pay is often below senior roles in other functions', 'Executive support roles value fit with one person'],
    entryRoles: ['Executive or operations coordinator', 'Office manager'],
    cost: { informal: [0, 300], formal: [0, 2000], formalWhat: 'an administrative professional certificate (optional)' },
  },
  Legal: {
    coreSkills: ['contract review', 'regulatory research', 'risk assessment', 'drafting', 'compliance programs', 'negotiation'],
    tools: ['a contract management system', 'legal research tools'],
    proof: 'Compliance or contract work you owned',
    challenges: ['Attorney roles require a law degree and bar admission', 'Compliance and contracts roles are the realistic entry point', 'Liability raises the cost of mistakes'],
    entryRoles: ['Compliance analyst', 'Contracts manager'],
    cost: { informal: [0, 1500], formal: [1000, 8000], formalWhat: 'a compliance or paralegal certificate; a law degree costs far more and takes years' },
  },
  'Customer Success': {
    coreSkills: ['onboarding customers', 'account planning', 'renewals and expansion', 'communication', 'product knowledge', 'escalation handling'],
    tools: ['a CRM', 'a customer success platform', 'a ticketing tool'],
    proof: 'Retention or satisfaction numbers from accounts you managed',
    challenges: ['Often measured on renewals you do not fully control', 'Needs deep product knowledge fast'],
    entryRoles: ['Customer success manager', 'Account manager'],
    cost: { informal: [0, 500], formal: [0, 2000], formalWhat: 'a customer success certification (optional)' },
  },
  'Data & Analytics': {
    coreSkills: ['SQL', 'statistics fundamentals', 'data visualization', 'spreadsheet modeling', 'a scripting language such as Python', 'explaining findings'],
    tools: ['SQL', 'a BI tool such as Tableau or Power BI', 'Python or R'],
    proof: 'Two analyses on real or public data that changed a decision',
    challenges: ['Employers screen on tools, so you must show them', 'Roles range from reporting to machine learning, and the training differs', 'Entry roles may pay less than your current level'],
    entryRoles: ['Data analyst', 'Business intelligence analyst'],
    cost: { informal: [0, 1500], formal: [1000, 15000], formalWhat: 'an analytics certificate or bootcamp' },
  },
}

// What each background brings. These are shown as "what you have", beside any
// skills we find on the member's résumé.
export const STRENGTHS_BY_FUNCTION: Record<string, string[]> = {
  Finance: ['analytical rigor and attention to detail', 'budgeting and forecasting', 'reporting to senior leaders', 'controls and process discipline'],
  Operations: ['running processes at scale', 'vendor and budget management', 'cross-team coordination', 'metrics and continuous improvement'],
  Marketing: ['understanding customers', 'storytelling and messaging', 'campaign and budget management', 'working with data on results'],
  Sales: ['understanding customer needs', 'negotiation', 'pipeline discipline', 'resilience'],
  Engineering: ['technical problem solving', 'systems thinking', 'building and shipping', 'working with specifications'],
  Product: ['prioritization', 'working across functions', 'customer discovery', 'metrics'],
  Design: ['user empathy', 'craft and visual judgment', 'iteration and critique', 'working with engineers'],
  'Human Resources': ['working with people and leaders', 'confidential judgment', 'policy and compliance', 'recruiting'],
  Administration: ['coordination and scheduling', 'discretion', 'communication', 'running systems'],
  Legal: ['risk judgment', 'precise writing', 'negotiation', 'regulatory knowledge'],
  'Customer Success': ['customer relationships', 'problem solving under pressure', 'renewals', 'product knowledge'],
  'Data & Analytics': ['quantitative thinking', 'tools fluency', 'explaining findings', 'structured problem solving'],
}

export type CostRange = { low: number; high: number; what: string }

export type Pathway = {
  from: string | null
  to: string
  feasibility: PivotFeasibility
  have: string[]
  need: string[]
  challenges: string[]
  entryRoles: string[]
  proof: string
  months: [number, number] | null
  cost: { INFORMAL: CostRange; FORMAL: CostRange }
  payNote: string
  // When they already hold the skills or have run this function before.
  headStart: string | null
}

const lower = (s: string) => s.toLowerCase()

// Skills the member already has: résumé keywords and confirmed skills that match what this function asks for.
function matchedSkills(core: string[], keywords: string[]): string[] {
  const k = keywords.map(lower)
  return core.filter((c) => {
    const words = lower(c).split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !['and', 'the', 'such', 'with'].includes(w))
    return words.some((w) => k.some((kw) => kw === w || kw.includes(w)))
  })
}

export function buildPathway(
  from: string | null,
  to: string,
  opts: { keywords?: string[]; seniorLevel?: boolean; ownedFunctions?: string[] } = {},
): Pathway | null {
  const profile = FUNCTION_PROFILES[to]
  if (!profile) return null
  const feasibility = assessPivot(from, to, { seniorLevel: opts.seniorLevel, ownedFunctions: opts.ownedFunctions })
  const matched = matchedSkills(profile.coreSkills, opts.keywords ?? [])
  const strengths = (from && STRENGTHS_BY_FUNCTION[from]) || []
  const have = [...matched.map((m) => `${m} (on your résumé)`), ...strengths.slice(0, Math.max(0, 4 - matched.length))]
  const need = profile.coreSkills.filter((c) => !matched.includes(c))
  const owned = (opts.ownedFunctions ?? []).includes(to)
  const payNote = feasibility.stepDown
    ? 'Plan for a lower starting salary and a more junior title than you have now. Most people close the gap over time, and how long depends on the field.'
    : feasibility.tier === 'SAME' || feasibility.tier === 'ADJACENT'
      ? 'Pay should be close to what you earn now.'
      : 'Pay is close to your current level if you can show the proof employers ask for; if not, expect a step down.'
  return {
    from,
    to,
    feasibility,
    have,
    need,
    challenges: profile.challenges,
    entryRoles: profile.entryRoles,
    proof: profile.proof,
    months: feasibility.months,
    cost: {
      INFORMAL: { low: profile.cost.informal[0], high: profile.cost.informal[1], what: 'Courses, tools and a project of your own' },
      FORMAL: { low: profile.cost.formal[0], high: profile.cost.formal[1], what: profile.cost.formalWhat },
    },
    payNote,
    headStart: owned ? `You told us you have already owned ${to} work. That counts: say so in your pitch and start from that.` : null,
  }
}

export const costText = (c: CostRange) => (c.high === 0 ? 'Free' : c.low === 0 ? `Up to $${c.high.toLocaleString('en-US')}` : `$${c.low.toLocaleString('en-US')} to $${c.high.toLocaleString('en-US')}`)

// ── Why do you like it? ─────────────────────────────────────────────────────

export const PIVOT_REASONS = [
  { key: 'craft', label: 'I like the work itself' },
  { key: 'creative', label: 'I want more creative work' },
  { key: 'pay', label: 'Pay and demand' },
  { key: 'flexibility', label: 'Flexibility or remote work' },
  { key: 'meaning', label: 'Meaning and impact' },
  { key: 'less_stress', label: 'Less stress' },
  { key: 'escape', label: 'I want out of what I do now' },
  { key: 'curious', label: 'I am curious' },
] as const
export type PivotReason = (typeof PIVOT_REASONS)[number]['key']

export type Alternative = { label: string; why: string; tier?: PivotTier }

// Functions that tend to deliver each reason, in order. The first ones that are closer to the member's own are suggested.
const FUNCTIONS_FOR_REASON: Record<PivotReason, string[]> = {
  craft: [],
  creative: ['Marketing', 'Product', 'Design'],
  pay: ['Data & Analytics', 'Product', 'Sales', 'Engineering'],
  flexibility: ['Data & Analytics', 'Marketing', 'Engineering'],
  meaning: ['Human Resources', 'Operations'],
  less_stress: ['Operations', 'Administration', 'Customer Success'],
  escape: [],
  curious: [],
}

// Smaller changes that often deliver the same thing.
const SMALLER_CHANGES: Record<PivotReason, Alternative[]> = {
  craft: [{ label: 'Try the work in your current role first', why: 'A four to six week project, or a stretch assignment, shows whether you like the day to day before you retrain.' }],
  creative: [{ label: 'Stay in your function and move to a more creative industry or company', why: 'Your own function is needed in media, design and brand-led companies, and you keep your level and pay.' }],
  pay: [{ label: 'Stay in your function and move to a higher-paying industry or company', why: 'A move of employer or industry often raises pay faster than starting a new function at the bottom.' }],
  flexibility: [{ label: 'Go fractional or consult in your own function', why: 'Many senior people get control of their time this way in months, not years.' }],
  meaning: [{ label: 'Take your function to a nonprofit or mission-led organization', why: 'The mission changes immediately and your experience is valued.' }],
  less_stress: [{ label: 'Take your function to a smaller or less regulated company', why: 'Pressure often comes from the employer and the industry, not the function.' }],
  escape: [{ label: 'Change employer or industry before you change function', why: 'If it is the boss, the culture or the company that is wrong, a new function will not fix it, and a new employer will, much faster.' }],
  curious: [{ label: 'Have three informational conversations first', why: 'It costs nothing, and tells you whether to go further.' }],
}

export type WorthKnowing = { text: string }

export function assessReason(from: string | null, to: string, reason: PivotReason, opts: { seniorLevel?: boolean } = {}) {
  const tier = pivotTier(from ?? '', to)
  const alternatives: Alternative[] = []
  for (const fn of FUNCTIONS_FOR_REASON[reason]) {
    if (fn === to || fn === from) continue
    const t = pivotTier(from ?? '', fn)
    // Only suggest what is closer than what they asked about.
    if (rank(t) < rank(tier)) alternatives.push({ label: fn, why: `${fn} often fits "${PIVOT_REASONS.find((r) => r.key === reason)!.label.toLowerCase()}" and is a smaller change from ${from ?? 'where you are'}.`, tier: t })
  }
  alternatives.sort((a, b) => rank(a.tier!) - rank(b.tier!))
  const out = [...alternatives.slice(0, 2), ...SMALLER_CHANGES[reason]].slice(0, 3)
  const worth: WorthKnowing[] = []
  const hard = tier === 'REBUILD' || tier === 'LICENSED'
  if (reason === 'pay' && (hard || opts.seniorLevel)) worth.push({ text: 'Pay usually drops first and recovers later. If pay is the main reason, a faster route is a better-paying employer or industry in your own function.' })
  if (reason === 'escape') worth.push({ text: 'Make sure what you want to leave is the function, not the employer. They feel the same from the inside.' })
  if (reason === 'less_stress' && tier !== 'ADJACENT') worth.push({ text: 'The first year in a new field is usually more stressful, not less, because you are new at it.' })
  if (reason === 'flexibility' && tier !== 'SAME' && tier !== 'ADJACENT') worth.push({ text: 'Newcomers get less flexibility at first. People with proven results in a function get more.' })
  if (reason === 'curious' && hard) worth.push({ text: 'A rebuild is a large commitment for curiosity. Test it with a small project before you decide.' })
  if (hard) worth.push({ text: 'It can be done and people do it. We will help you either way, and we suggest testing it cheaply before you commit.' })
  return { alternatives: out, worth }
}

function rank(t: PivotTier): number {
  return { SAME: 0, ADJACENT: 1, BRIDGE: 2, REBUILD: 3, LICENSED: 4, LEVEL_GATED: 5 }[t]
}

const OWNED_MAP: Record<string, string> = {
  MARKETING: 'Marketing', SALES: 'Sales', FINANCE: 'Finance', HR: 'Human Resources', LEGAL: 'Legal', OPERATIONS: 'Operations',
  PRODUCT: 'Product', ENGINEERING: 'Engineering', CUSTOMER_SUCCESS: 'Customer Success',
}

// Track Record "functions you have owned outside your core discipline" -> our function names.
export function ownedFunctionsFrom(values: string[] | null | undefined): string[] {
  return (values ?? []).map((v) => OWNED_MAP[v]).filter((v): v is string => !!v)
}
