// How realistic is a move from one job function to another? Pure and client-safe.
// A controller can become an FP&A lead with a course or two; a designer is a
// rebuild that needs real training and a step down. This is a judgment table,
// not a prediction: it exists so we never rank someone against roles they
// cannot yet win, and so a big change comes with an honest education plan and a
// commitment. Where O*NET data is loaded, the Pivot Tool adds skill-level
// detail (src/lib/careers); this works without it.

import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

export type PivotTier = 'SAME' | 'ADJACENT' | 'BRIDGE' | 'REBUILD' | 'LICENSED' | 'LEVEL_GATED'
export type BridgeRoute = 'INFORMAL' | 'FORMAL'

export type PivotFeasibility = {
  from: string
  to: string
  tier: PivotTier
  headline: string
  detail: string
  // Months of focused learning and proof before roles in the new function are realistic.
  months: [number, number] | null
  // Whether the member must commit (a route, hours a week) before we search for it.
  needsCommitment: boolean
  // Expect to start below your current level or pay.
  stepDown: boolean
  // Education that closes the gap, by route.
  education: { INFORMAL: string[]; FORMAL: string[] } | null
}

type Fn = (typeof PRIMARY_FUNCTION_OPTIONS)[number]

const pair = (a: Fn, b: Fn) => [a, b].sort().join('|')
const ADJACENT_PAIRS = new Set([
  pair('Finance', 'Operations'),
  pair('Finance', 'Administration'),
  pair('Finance', 'Data & Analytics'),
  pair('Operations', 'Administration'),
  pair('Operations', 'Customer Success'),
  pair('Operations', 'Human Resources'),
  pair('Operations', 'Product'),
  pair('Human Resources', 'Administration'),
  pair('Sales', 'Customer Success'),
  pair('Sales', 'Marketing'),
  pair('Marketing', 'Customer Success'),
  pair('Product', 'Data & Analytics'),
])

// Only these can enter engineering or design without starting over.
const TO_ENGINEERING_BRIDGE = new Set<string>(['Data & Analytics', 'Product'])
const TO_DESIGN_BRIDGE = new Set<string>(['Marketing', 'Product'])

export function pivotTier(from: string, to: string): PivotTier {
  if (from === to) return 'SAME'
  if (to === 'Executive Leadership') return 'LEVEL_GATED'
  // We do not know enough to say it is hard.
  if (!from || ['General', 'Other'].includes(from) || ['General', 'Other'].includes(to)) return 'ADJACENT'
  if (to === 'Legal') return 'LICENSED'
  if (ADJACENT_PAIRS.has(pair(from as Fn, to as Fn))) return 'ADJACENT'
  if (to === 'Engineering') return TO_ENGINEERING_BRIDGE.has(from) ? 'BRIDGE' : 'REBUILD'
  if (to === 'Design') return TO_DESIGN_BRIDGE.has(from) ? 'BRIDGE' : 'REBUILD'
  return 'BRIDGE'
}

const EDUCATION: Record<string, { INFORMAL: string[]; FORMAL: string[] }> = {
  Design: {
    INFORMAL: ['Build 3 portfolio projects with real constraints', 'A recognized online design course, finished', 'Weekly critique from a working designer'],
    FORMAL: ['A design certificate or bootcamp (3 to 12 months)', 'A part-time graduate program in design or HCI', 'Ask your target employers which credentials they actually hire on'],
  },
  Engineering: {
    INFORMAL: ['A structured course in one language, finished, with a shipped project', 'Contribute to an open-source project', 'Pair with an engineer weekly'],
    FORMAL: ['A coding bootcamp or an accredited certificate', 'A part-time computer science degree or master’s', 'Ask target employers whether a degree is required'],
  },
  'Data & Analytics': {
    INFORMAL: ['SQL and a BI tool, with two analyses on public data', 'A recognized analytics certificate course', 'Offer to take on a data project in your current role'],
    FORMAL: ['A data analytics certificate', 'A part-time master’s in analytics or data science'],
  },
  Product: {
    INFORMAL: ['Run a small product project start to finish', 'A product management course, finished', 'Shadow a product manager for a month'],
    FORMAL: ['A product management certificate', 'An MBA or applied program with a product track'],
  },
  Finance: {
    INFORMAL: ['Financial modeling course and a model you built', 'Take on budget ownership in your current role'],
    FORMAL: ['A finance certificate (CMA, CFA level 1 or similar, by role)', 'A part-time MBA or master’s in finance'],
  },
  Legal: {
    INFORMAL: ['Compliance, contracts or policy work inside your function first'],
    FORMAL: ['Law degree and bar admission for attorney roles', 'A paralegal or compliance certificate for adjacent roles'],
  },
  Marketing: {
    INFORMAL: ['A marketing fundamentals course, finished', 'Run a small campaign and report the result'],
    FORMAL: ['A digital marketing certificate', 'A part-time marketing master’s'],
  },
}

const DEFAULT_EDUCATION = {
  INFORMAL: ['A recognized course in the new function, finished', 'One project you can show', 'Three conversations with people doing the work'],
  FORMAL: ['A certificate or part-time degree that employers in the new function ask for', 'Ask target employers which credential they require'],
}

// `stepDown` grows with seniority: a VP moving across functions starts lower.
export function assessPivot(from: string | null, to: string, opts: { seniorLevel?: boolean; ownedFunctions?: string[] } = {}): PivotFeasibility {
  const f = from ?? ''
  let tier = pivotTier(f, to)
  // They have already run this function (Track Record: functions owned outside their core): a head start.
  if (opts.ownedFunctions?.includes(to) && (tier === 'BRIDGE' || tier === 'REBUILD')) tier = tier === 'BRIDGE' ? 'ADJACENT' : 'BRIDGE'
  const edu = EDUCATION[to] ?? DEFAULT_EDUCATION
  switch (tier) {
    case 'SAME':
      return { from: f, to, tier, headline: 'This is your current function', detail: 'Nothing to bridge.', months: null, needsCommitment: false, stepDown: false, education: null }
    case 'ADJACENT':
      return {
        from: f, to, tier,
        headline: 'A natural move',
        detail: `Your experience carries over into ${to}. A course or a project closes most of the gap, and we will include these roles in your search now.`,
        months: [0, 3], needsCommitment: false, stepDown: false, education: { INFORMAL: edu.INFORMAL.slice(0, 2), FORMAL: [] },
      }
    case 'BRIDGE':
      return {
        from: f, to, tier,
        headline: 'Possible with focused learning and proof',
        detail: `Moving from ${f} to ${to} usually takes months of learning and something you can show, such as a project or certificate. We will search these roles once you commit to a route.`,
        months: [6, 18], needsCommitment: true, stepDown: !!opts.seniorLevel, education: edu,
      }
    case 'REBUILD':
      return {
        from: f, to, tier,
        headline: 'A rebuild, not a step',
        detail: `${f} to ${to} means learning a new craft from the ground up and usually starting below your current level and pay. It can be done, and people do it, but it takes formal or sustained training and a commitment. We will not search these roles until you pick a route and commit.`,
        months: [12, 36], needsCommitment: true, stepDown: true, education: edu,
      }
    case 'LICENSED':
      return {
        from: f, to, tier,
        headline: 'Needs a license or degree',
        detail: 'Attorney roles require a law degree and bar admission. Compliance, contracts and policy roles inside your own function are the realistic first step.',
        months: [36, 54], needsCommitment: true, stepDown: true, education: edu,
      }
    case 'LEVEL_GATED':
      return {
        from: f, to, tier,
        headline: 'A level, not a function',
        detail: 'Executive roles come from level and results. Use Going for a promotion, or search at your level in your own function.',
        months: null, needsCommitment: false, stepDown: false, education: null,
      }
  }
}

// A target the search should include now: no commitment needed, or one made.
export function isSearchable(tier: PivotTier, committed: boolean): boolean {
  if (tier === 'SAME' || tier === 'ADJACENT') return true
  if (tier === 'LEVEL_GATED') return false
  return committed
}
