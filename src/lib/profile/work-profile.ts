// Work profile: how a person likes to work, on ten "this or that" dimensions,
// each from -1 (the first pole) to +1 (the second). Pure and client-safe.
//
// Most dimensions are inferred from answers people already gave (How I Work
// Best, the people-energy question, What I Need, Track Record, search
// priorities, remote preference). A short "this or that" card fills the rest;
// the person's own answer always wins. Each value carries a confidence so a
// guess never steers ranking as hard as an answer.
//
// Roles carry the same ten dimensions (ROLE_WORK_PROFILES, an editorial
// estimate per pivot-map role), so a job or pivot can say "fits how you
// work" or "this role is mostly solo desk work, and you prefer variety".

export type WorkDim = 'social' | 'approach' | 'altitude' | 'schedule' | 'teaming' | 'learning' | 'track' | 'drive' | 'risk' | 'setting'

export const WORK_DIMS: { key: WorkDim; low: string; high: string; question: string }[] = [
  { key: 'social', low: 'Recharge with focused, quiet work', high: 'Energized by lots of people', question: 'Which day leaves you with more energy?' },
  { key: 'approach', low: 'Follow a proven process', high: 'Invent a new way', question: 'Which do you enjoy more?' },
  { key: 'altitude', low: 'Get the details exactly right', high: 'See the big picture', question: 'Where do you add the most?' },
  { key: 'schedule', low: 'Set hours and a place to go', high: 'Flexible hours and location', question: 'Which week suits you better?' },
  { key: 'teaming', low: 'Own my piece end to end', high: 'Build it together with a team', question: 'How do you like to get work done?' },
  { key: 'learning', low: 'Figure it out myself', high: 'A clear plan and training', question: 'Starting something new, you’d rather…' },
  { key: 'track', low: 'Do the work myself', high: 'Lead people who do the work', question: 'Next, would you rather…' },
  { key: 'drive', low: 'Steady, sustainable pace', high: 'Climb as fast as I can', question: 'Right now in your career you want…' },
  { key: 'risk', low: 'Safety and a sure paycheck', high: 'Upside, even with risk', question: 'Given the choice, you’d take…' },
  { key: 'setting', low: 'At a desk or screen', high: 'Out in the real world', question: 'Where would you rather spend your day?' },
]

export type WorkValue = { value: number; confidence: number; from: string[] }
export type WorkProfile = Record<WorkDim, WorkValue | null>

export type WorkProfileInput = {
  workStyleAnswers?: unknown
  // How I Work Best vectors, -1..+1 (velocity, definition, collaboration, directness, oversight, commitment, rigor).
  vectors?: Record<string, number> | null
  peopleEnergy?: 'HIGH' | 'SOME' | 'LOW' | null
  remotePreference?: string | null
  creativityConfidence?: number | null
  managementSkillConfidence?: number | null
  isPeopleManager?: boolean | null
  equityImportant?: boolean | null
  priorityJobSecurity?: number | null
  priorityMaxComp?: number | null
  priorityWorkLife?: number | null
  // What I Need ratings, 1-4, by item id.
  needs?: Record<string, number> | null
  // Track Record bands.
  largestTeamManaged?: string | null
  droveOutcomesThroughOthers?: number | null
}

const clamp = (x: number) => Math.max(-1, Math.min(1, x))

export function readAnswers(json: unknown): Partial<Record<WorkDim, { value: number; at: string }>> {
  if (!json || typeof json !== 'object') return {}
  const out: Partial<Record<WorkDim, { value: number; at: string }>> = {}
  for (const d of WORK_DIMS) {
    const v = (json as Record<string, { value?: unknown; at?: unknown }>)[d.key]
    if (v && typeof v.value === 'number' && v.value >= -2 && v.value <= 2) out[d.key] = { value: v.value, at: typeof v.at === 'string' ? v.at : '' }
  }
  return out
}

// Combine weighted signals into one value and a confidence (0..1).
function blend(signals: { v: number | null | undefined; w: number; from: string }[]): WorkValue | null {
  const have = signals.filter((s) => typeof s.v === 'number' && !Number.isNaN(s.v)) as { v: number; w: number; from: string }[]
  if (!have.length) return null
  const wsum = have.reduce((n, s) => n + s.w, 0)
  return { value: clamp(have.reduce((n, s) => n + s.v * s.w, 0) / wsum), confidence: Math.min(0.7, wsum * 0.35), from: have.map((s) => s.from) }
}
const need = (n: Record<string, number> | null | undefined, id: string) => (n && typeof n[id] === 'number' ? (n[id] - 2.5) / 1.5 : null) // 1..4 to -1..+1
const conf100 = (x: number | null | undefined) => (typeof x === 'number' ? (x - 50) / 50 : null)
const TEAM_BAND: Record<string, number> = { NONE: -1, ONE_TO_FIVE: 0, SIX_TO_TWENTY: 0.5, TWENTY_ONE_TO_FIFTY: 0.8, FIFTY_ONE_TO_TWO_HUNDRED: 1, TWO_HUNDRED_PLUS: 1 }
// Ranks are 1..10, lower = more important; return -1..+1 for "a matters more than b".
const rankLean = (a: number | null | undefined, b: number | null | undefined) => (typeof a === 'number' && typeof b === 'number' ? clamp((b - a) / 5) : null)

export function workProfile(input: WorkProfileInput): WorkProfile {
  const v = input.vectors ?? {}
  const n = input.needs ?? null
  const remote = input.remotePreference?.toLowerCase()
  const inferred: Record<WorkDim, WorkValue | null> = {
    social: blend([
      { v: input.peopleEnergy === 'HIGH' ? 1 : input.peopleEnergy === 'LOW' ? -1 : input.peopleEnergy === 'SOME' ? 0 : null, w: 1.5, from: 'People-energy question' },
      { v: v.collaboration, w: 0.8, from: 'How I Work Best' },
    ]),
    approach: blend([
      { v: v.definition, w: 1, from: 'How I Work Best' },
      { v: conf100(input.creativityConfidence), w: 0.6, from: 'Skills self-rating' },
      { v: typeof v.rigor === 'number' ? -v.rigor * 0.6 : null, w: 0.4, from: 'How I Work Best' },
    ]),
    altitude: blend([{ v: typeof v.rigor === 'number' ? -v.rigor : null, w: 1, from: 'How I Work Best' }]),
    schedule: blend([
      { v: remote === 'remote' ? 1 : remote === 'hybrid' ? 0.2 : remote === 'onsite' ? -0.8 : remote === 'flexible' ? 0.4 : null, w: 1, from: 'Remote preference' },
      { v: need(n, 'working-conditions-3'), w: 0.6, from: 'What I Need' },
      { v: rankLean(input.priorityWorkLife, input.priorityMaxComp), w: 0.4, from: 'Search priorities' },
    ]),
    teaming: blend([
      { v: v.collaboration, w: 1, from: 'How I Work Best' },
      { v: need(n, 'relationships-4'), w: 0.6, from: 'What I Need' },
      { v: need(n, 'independence-1') !== null ? -need(n, 'independence-1')! : null, w: 0.4, from: 'What I Need' },
    ]),
    learning: blend([
      { v: typeof v.definition === 'number' ? -v.definition : null, w: 0.8, from: 'How I Work Best' },
      { v: need(n, 'support-3'), w: 0.8, from: 'What I Need' },
      { v: need(n, 'support-2'), w: 0.4, from: 'What I Need' },
      { v: need(n, 'independence-3') !== null ? -need(n, 'independence-3')! : null, w: 0.5, from: 'What I Need' },
    ]),
    track: blend([
      { v: conf100(input.managementSkillConfidence), w: 0.8, from: 'Skills self-rating' },
      { v: input.largestTeamManaged ? TEAM_BAND[input.largestTeamManaged] ?? null : input.isPeopleManager === true ? 0.5 : input.isPeopleManager === false ? -0.6 : null, w: 0.6, from: 'Track Record' },
      { v: typeof input.droveOutcomesThroughOthers === 'number' ? (input.droveOutcomesThroughOthers - 2.5) / 1.5 : null, w: 0.4, from: 'Track Record' },
    ]),
    drive: blend([
      { v: need(n, 'recognition-1'), w: 0.8, from: 'What I Need' },
      { v: need(n, 'working-conditions-1') !== null ? -need(n, 'working-conditions-1')! : null, w: 0.6, from: 'What I Need' },
      { v: v.commitment, w: 0.5, from: 'How I Work Best' },
    ]),
    risk: blend([
      { v: rankLean(input.priorityMaxComp, input.priorityJobSecurity), w: 0.8, from: 'Search priorities' },
      { v: input.equityImportant ? 0.6 : null, w: 0.5, from: 'Search priorities' },
      { v: need(n, 'working-conditions-1') !== null ? -need(n, 'working-conditions-1')! : null, w: 0.5, from: 'What I Need' },
    ]),
    setting: null, // nothing we already ask tells desk from field: the card asks it
  }
  const answers = readAnswers(input.workStyleAnswers)
  return Object.fromEntries(
    WORK_DIMS.map((d) => {
      const a = answers[d.key]
      return [d.key, a ? { value: a.value / 2, confidence: 1, from: ['Your answer'] } : inferred[d.key]]
    }),
  ) as WorkProfile
}

// Dimensions the card should ask: never answered, and not inferred with confidence.
export function missingDims(p: WorkProfile): WorkDim[] {
  return WORK_DIMS.filter((d) => !p[d.key] || p[d.key]!.confidence < 0.5).map((d) => d.key)
}

export function describe(d: WorkDim, value: number): string {
  const def = WORK_DIMS.find((x) => x.key === d)!
  if (Math.abs(value) < 0.25) return `Either: ${def.low.toLowerCase()} or ${def.high.toLowerCase()}`
  return value < 0 ? def.low : def.high
}

// ── Roles on the same ten dimensions ─────────────────────────────────────────
// Order: social, approach, altitude, schedule, teaming, learning, track, drive, risk, setting; -2..+2.
// An editorial estimate of what the work usually asks, not a rule.
const R: Record<string, string> = {
  recruiter: '2 0 0 0 0 0 -1 1 0 -1',
  account_executive: '2 0 1 1 -1 -1 -1 2 2 0',
  business_development: '2 1 1 1 -1 -1 -1 2 2 1',
  partnerships: '2 1 1 1 0 -1 -1 1 1 0',
  search_firm_consultant: '2 0 0 1 -1 -1 -1 2 2 -1',
  sales_development: '2 -1 -1 -1 0 1 -2 2 1 -1',
  customer_success: '1 0 0 0 1 0 -1 0 -1 -1',
  people_operations: '0 -1 -1 -1 1 0 0 0 -1 -1',
  hr_generalist: '1 -1 -1 -1 1 0 0 0 -2 -1',
  hris: '-1 -1 -2 1 0 0 -1 0 -1 -2',
  people_analytics: '-1 0 -1 1 0 -1 -1 0 -1 -2',
  learning_development: '1 1 0 0 1 0 -1 0 -1 0',
  compensation: '-1 -1 -2 0 0 0 -1 0 -1 -2',
  talent_acquisition: '2 0 0 0 0 0 -1 1 -1 -1',
  hrbp: '1 0 1 -1 1 0 0 1 -1 -1',
  management_consulting: '1 1 1 -1 1 -1 0 2 0 0',
  consulting: '1 1 1 -1 1 -1 0 2 0 0',
  operations_management: '1 0 1 -1 1 -1 1 1 0 0',
  customer_service: '2 -2 -1 -2 0 2 -2 -1 -2 -1',
  account_manager: '2 0 0 0 0 0 -1 1 0 -1',
  account_management: '2 0 0 0 0 0 -1 1 0 -1',
  implementation: '1 -1 -1 0 1 0 -1 0 -1 0',
  support_operations: '-1 -1 -1 0 0 0 0 0 -1 -2',
  customer_education: '2 0 0 0 0 0 -1 0 -1 -1',
  solutions_consulting: '1 1 0 1 1 -1 -1 1 1 0',
  sales_enablement: '1 1 0 0 1 0 -1 0 -1 -1',
  sales: '2 0 1 1 -1 -1 -1 2 2 0',
  revenue_operations: '-1 -1 -1 1 0 -1 -1 0 -1 -2',
  marketing: '0 1 1 0 1 0 -1 1 0 -1',
  product_marketing: '0 1 1 1 1 -1 -1 1 0 -1',
  marketing_operations: '-1 -1 -1 1 0 0 -1 0 -1 -2',
  community_management: '2 1 0 1 1 0 -1 0 0 -1',
  operations: '0 -1 0 -1 1 0 0 0 -1 0',
  program_management: '1 -1 1 0 1 0 0 1 -1 -1',
  procurement: '0 -1 -1 -1 0 0 -1 0 -1 -1',
  logistics_supply_chain: '0 -1 -1 -2 1 0 0 0 -1 1',
  business_analyst: '0 -1 -1 0 1 0 -1 0 -1 -2',
  project_program: '1 -1 0 0 1 0 0 0 -1 -1',
  project_management: '1 -1 0 0 1 0 0 0 -1 -1',
  technical_program_management: '1 -1 0 0 1 -1 0 1 -1 -2',
  product_management: '1 1 1 0 1 -1 -1 1 1 -1',
  product: '1 1 1 0 1 -1 -1 1 1 -1',
  product_operations: '0 -1 0 0 1 0 -1 0 -1 -2',
  finance_accounting: '-1 -2 -2 -1 0 0 -1 0 -2 -2',
  fpa: '-1 -1 -1 -1 0 0 -1 1 -1 -2',
  compliance: '-1 -2 -2 -1 0 1 -1 0 -2 -1',
  teaching: '2 0 0 -2 0 0 0 -1 -2 1',
  instructional_design: '-1 1 -1 1 0 0 -1 0 -1 -2',
  nursing_clinical: '2 -1 -1 -2 1 1 0 0 -1 2',
  clinical_informatics: '0 -1 -1 0 1 0 -1 0 -1 -1',
  clinical_operations: '1 -1 -1 -1 1 0 0 0 -1 0',
  healthcare_sales: '2 0 0 1 -1 -1 -1 2 1 2',
  admin_ea: '1 -1 -2 -2 1 1 -2 -1 -2 -1',
  event_management: '2 1 -1 -1 1 0 -1 0 0 2',
  data_analytics: '-1 0 -1 1 0 -1 -1 0 0 -2',
  data_analyst: '-1 0 -1 1 0 -1 -1 0 0 -2',
  engineering: '-1 1 -1 1 0 -1 -1 1 0 -2',
  developer_relations: '2 1 0 1 1 -1 -1 1 0 0',
  design: '-1 2 -1 1 0 -1 -1 0 0 -2',
  ux_research: '1 1 0 1 1 0 -1 0 0 0',
  content_marketing: '-1 1 0 1 0 -1 -1 0 0 -2',
  legal: '0 -1 -2 -1 0 0 -1 1 -2 -1',
  contracts_management: '0 -1 -2 0 0 0 -1 0 -2 -2',
  legal_operations: '-1 -1 -1 0 0 0 -1 0 -1 -2',
  government_contracting: '1 -1 -1 -1 1 0 -1 0 -1 0',
  retail_management: '2 -1 0 -2 1 0 1 0 -1 2',
  hospitality: '2 0 -1 -2 1 1 0 0 -1 2',
  military_government: '1 -1 0 -2 1 1 0 0 -2 1',
  security_risk: '0 -1 -1 -1 0 0 -1 0 -2 0',
  fundraising: '2 0 1 0 0 -1 -1 1 1 1',
  investment: '0 0 -1 -2 0 -1 -1 2 1 -2',
  corporate_development: '0 0 1 -1 1 -1 -1 1 0 -2',
}
export const ROLE_WORK_PROFILES: Record<string, Record<WorkDim, number>> = Object.fromEntries(
  Object.entries(R).map(([k, s]) => [k, Object.fromEntries(s.split(' ').map((x, i) => [WORK_DIMS[i].key, Number(x) / 2])) as Record<WorkDim, number>]),
)

export type WorkFit = { score: number; fits: string[]; clashes: { dim: WorkDim; line: string }[] }

// How well a role suits how this person likes to work. Only dimensions where
// the person leans clearly (|value| >= 0.4) and the role does too count; a
// clash is opposite strong leans. score -1..+1, 0 = no signal.
export function workFit(person: WorkProfile, roleKey: string): WorkFit {
  const role = ROLE_WORK_PROFILES[roleKey]
  if (!role) return { score: 0, fits: [], clashes: [] }
  let total = 0
  let weight = 0
  const fits: string[] = []
  const clashes: WorkFit['clashes'] = []
  for (const d of WORK_DIMS) {
    const p = person[d.key]
    const r = role[d.key]
    if (!p || Math.abs(p.value) < 0.4 || Math.abs(r) < 0.5) continue
    const agree = Math.sign(p.value) === Math.sign(r)
    const w = p.confidence * Math.min(1, Math.abs(p.value)) * Math.abs(r)
    total += (agree ? 1 : -1) * w
    weight += w
    if (agree) fits.push(r < 0 ? d.low : d.high)
    else clashes.push({ dim: d.key, line: `This role is mostly “${(r < 0 ? d.low : d.high).toLowerCase()}”; you prefer “${(p.value < 0 ? d.low : d.high).toLowerCase()}”.` })
  }
  return { score: weight ? total / weight : 0, fits, clashes }
}
