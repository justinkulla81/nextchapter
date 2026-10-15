// Strengths: where a person stands out, the "why hire you". Pure; the loader
// (strengths-load.ts) gathers the inputs. No AI here.
//
// Nine strengths, each scored 0..1 from whatever evidence exists: How I
// Perform (and how it compares with peers in the same function), references'
// ratings and superpower notes, Track Record scale, the skills matrix, and
// the strengths the person picked. A strength backed by two kinds of
// evidence counts more than one the person only picked.
//
// The result has a shape:
//   peaked   - one to three clear peaks: lead with them.
//   balanced - no single peak but strong across most: sell range.
//   emerging - not enough evidence yet: say what would show it.
// Weak spots are kept private: they steer job and pivot ranking and coaching,
// and never appear to employers.

export type StrengthKey = 'expertise' | 'execution' | 'judgment' | 'composure' | 'influence' | 'leadership' | 'scale' | 'collaboration' | 'adaptability'

export const STRENGTHS: { key: StrengthKey; label: string; pitch: string; weakSpot: string }[] = [
  { key: 'expertise', label: 'Deep expertise', pitch: 'brings deep, proven skill in the work itself', weakSpot: 'Roles that need deep specialist skills you haven’t shown yet' },
  { key: 'execution', label: 'Gets things done', pitch: 'reliably turns plans into results, on time', weakSpot: 'Roles judged mainly on fast, relentless output' },
  { key: 'judgment', label: 'Sound judgment', pitch: 'makes good calls with incomplete information', weakSpot: 'Roles where you’d make high-stakes calls alone from day one' },
  { key: 'composure', label: 'Calm under pressure', pitch: 'stays steady when things go wrong', weakSpot: 'Constant crisis work (incidents, escalations)' },
  { key: 'influence', label: 'Influence and communication', pitch: 'brings people along: explains clearly and persuades', weakSpot: 'Roles built on persuading skeptical buyers or executives' },
  { key: 'leadership', label: 'Leads people', pitch: 'builds and leads teams that perform', weakSpot: 'Leading a large team right away' },
  { key: 'scale', label: 'Operates at scale', pitch: 'has owned large budgets, P&Ls or programs', weakSpot: 'Roles that start with a large budget or P&L' },
  { key: 'collaboration', label: 'Great to work with', pitch: 'makes the people around them better', weakSpot: 'Roles that are mostly cross-team coordination' },
  { key: 'adaptability', label: 'Learns fast and adapts', pitch: 'gets good at new things quickly', weakSpot: 'Fast-changing roles with little support' },
]

export type StrengthInput = {
  // How I Perform, 1-4 scale, and percentile among peers in the same function (0..1) when there are enough.
  perf?: { execution: number; judgment: number; composure: number; influence: number } | null
  perfPercentile?: Partial<Record<'execution' | 'judgment' | 'composure' | 'influence', number>> | null
  // Completed references' 1-5 trait ratings (averaged) and how many references gave them.
  refs?: { adaptability?: number | null; followThrough?: number | null; presence?: number | null; collaboration?: number | null; composure?: number | null; count: number; superpowers: string[] } | null
  track?: { team?: string | null; org?: string | null; budget?: string | null; pnl?: string | null; initiative?: string | null } | null
  skills?: { strong: number; expert: number; total: number } | null
  yearsExperience?: number | null
  picked?: string[] // TOP_STRENGTH_OPTIONS values
}

export type StrengthScore = { key: StrengthKey; label: string; score: number; evidence: string[]; sources: number; pitch: string }
export type StrengthProfile = {
  shape: 'peaked' | 'balanced' | 'emerging'
  peaks: StrengthScore[]
  broad: StrengthScore[] // strong-but-not-peak, for the balanced pitch
  weakSpots: { key: StrengthKey; label: string; line: string }[]
  all: StrengthScore[]
  missing: string[] // what would sharpen the read
}

const SIZE: Record<string, number> = { NONE: 0, ONE_TO_FIVE: 0.3, SIX_TO_TWENTY: 0.55, TWENTY_ONE_TO_FIFTY: 0.75, FIFTY_ONE_TO_TWO_HUNDRED: 0.9, TWO_HUNDRED_PLUS: 1 }
const MONEY: Record<string, number> = { NONE: 0, UNDER_100K: 0.2, ONE_HUNDRED_K_TO_1M: 0.45, ONE_M_TO_10M: 0.7, TEN_M_TO_100M: 0.9, OVER_100M: 1 }
const SIZE_WORDS: Record<string, string> = { ONE_TO_FIVE: '1–5', SIX_TO_TWENTY: '6–20', TWENTY_ONE_TO_FIFTY: '21–50', FIFTY_ONE_TO_TWO_HUNDRED: '51–200', TWO_HUNDRED_PLUS: '200+' }
const MONEY_WORDS: Record<string, string> = { UNDER_100K: 'under $100K', ONE_HUNDRED_K_TO_1M: '$100K–$1M', ONE_M_TO_10M: '$1M–$10M', TEN_M_TO_100M: '$10M–$100M', OVER_100M: 'over $100M' }
const PICK: Record<string, StrengthKey> = {
  expert_in_field: 'expertise',
  fast_learner: 'adaptability',
  clear_communicator: 'influence',
  calm_under_pressure: 'composure',
  team_player: 'collaboration',
  people_manager: 'leadership',
  detail_oriented: 'execution',
  work_ethic: 'execution',
}

type Signal = { v: number; w: number; evidence: string; objective: boolean }

export function scoreStrengths(input: StrengthInput): StrengthProfile {
  const sig: Record<StrengthKey, Signal[]> = { expertise: [], execution: [], judgment: [], composure: [], influence: [], leadership: [], scale: [], collaboration: [], adaptability: [] }
  const perf = input.perf
  const pct = input.perfPercentile ?? {}
  const perfSig = (key: StrengthKey, dim: 'execution' | 'judgment' | 'composure' | 'influence', name: string) => {
    if (!perf) return
    const p = pct[dim]
    const v = typeof p === 'number' ? p : Math.max(0, (perf[dim] - 1) / 3)
    sig[key].push({ v, w: 1, objective: true, evidence: typeof p === 'number' ? `How I Perform ${name}: higher than ${Math.round(p * 100)}% of people in your field` : `How I Perform ${name}: ${perf[dim].toFixed(1)} of 4` })
  }
  perfSig('execution', 'execution', 'execution')
  perfSig('judgment', 'judgment', 'judgment')
  perfSig('composure', 'composure', 'composure')
  perfSig('influence', 'influence', 'influence')

  const r = input.refs
  if (r && r.count > 0) {
    const ref = (key: StrengthKey, v: number | null | undefined, name: string) => {
      if (typeof v === 'number') sig[key].push({ v: Math.max(0, (v - 1) / 4), w: 1.2, objective: true, evidence: `${r.count} reference${r.count === 1 ? '' : 's'} rated your ${name} ${v.toFixed(1)} of 5` })
    }
    ref('adaptability', r.adaptability, 'adaptability')
    ref('execution', r.followThrough, 'follow-through')
    ref('influence', r.presence, 'presence')
    ref('collaboration', r.collaboration, 'collaboration')
    ref('composure', r.composure, 'composure')
  }

  const t = input.track
  if (t) {
    const team = Math.max(SIZE[t.team ?? ''] ?? 0, (SIZE[t.org ?? ''] ?? 0) * 0.8)
    if (t.team || t.org) sig.leadership.push({ v: team, w: 1, objective: true, evidence: t.team && SIZE_WORDS[t.team] ? `Led a team of ${SIZE_WORDS[t.team]}` : 'Led people indirectly' })
    const money = Math.max(MONEY[t.budget ?? ''] ?? 0, MONEY[t.initiative ?? ''] ?? 0)
    const pnlBoost = t.pnl === 'PNL' ? 0.15 : 0
    if (t.budget || t.initiative || t.pnl) {
      const words = [t.budget && MONEY_WORDS[t.budget] ? `owned a budget of ${MONEY_WORDS[t.budget]}` : null, t.pnl === 'PNL' ? 'carried a P&L' : null, t.initiative && MONEY_WORDS[t.initiative] ? `led an initiative of ${MONEY_WORDS[t.initiative]}` : null].filter(Boolean)
      sig.scale.push({ v: Math.min(1, money + pnlBoost), w: 1, objective: true, evidence: words.length ? `You ${words.join(', ')}` : 'Budget responsibility' })
    }
  }

  const s = input.skills
  if (s && s.total > 0) {
    const used = Math.max(0, s.total - s.strong - s.expert)
    const v = Math.min(1, (s.expert * 2 + s.strong + 0.3 * used) / 10 + (input.yearsExperience ? Math.min(0.2, input.yearsExperience / 75) : 0))
    sig.expertise.push({ v, w: 1, objective: true, evidence: `${s.expert} expert and ${s.strong} strong skills in your skills matrix${input.yearsExperience ? `, ${input.yearsExperience} years in` : ''}` })
  }

  for (const p of input.picked ?? []) {
    const k = PICK[p]
    if (k) sig[k].push({ v: 0.75, w: 0.6, objective: false, evidence: 'You picked it as a top strength' })
  }

  const all: StrengthScore[] = STRENGTHS.map((d) => {
    const xs = sig[d.key]
    if (!xs.length) return { key: d.key, label: d.label, score: 0, evidence: [], sources: 0, pitch: d.pitch }
    const w = xs.reduce((n, x) => n + x.w, 0)
    let score = xs.reduce((n, x) => n + x.v * x.w, 0) / w
    const objective = xs.filter((x) => x.objective).length
    // A pick with nothing objective behind it can't make a peak on its own.
    if (!objective) score = Math.min(score, 0.5)
    // Two or more kinds of evidence agreeing: a little more confidence.
    if (objective >= 2 && score >= 0.6) score = Math.min(1, score + 0.05)
    return { key: d.key, label: d.label, score, evidence: xs.map((x) => x.evidence), sources: xs.length, pitch: d.pitch }
  })
  const measured = all.filter((a) => a.sources > 0)
  const peaks = [...measured].filter((a) => a.score >= 0.75).sort((a, b) => b.score - a.score).slice(0, 3)
  const broad = measured.filter((a) => a.score >= 0.55 && !peaks.includes(a)).sort((a, b) => b.score - a.score)
  const shape: StrengthProfile['shape'] = peaks.length ? 'peaked' : broad.length >= 3 ? 'balanced' : 'emerging'
  const weakSpots = measured
    // A short skills list says little about a lack of expertise, so it never makes a weak spot.
    .filter((a) => a.score <= 0.35 && a.key !== 'expertise' && sig[a.key].some((x) => x.objective))
    .map((a) => ({ key: a.key, label: a.label, line: STRENGTHS.find((d) => d.key === a.key)!.weakSpot }))
  const missing = [
    !perf ? 'Take How I Perform (10 minutes) to measure execution, judgment, composure and influence' : null,
    !r || r.count === 0 ? 'Ask two references; what they say counts more than anything you say yourself' : null,
    !t ? 'Fill in Track Record so we can see the scale you’ve worked at' : null,
    !s || s.total === 0 ? 'Upload your resume so we can build your skills matrix' : null,
  ].filter((x): x is string => !!x)
  return { shape, peaks, broad, weakSpots, all, missing }
}

// A short headline anyone can read, without AI.
export function strengthHeadline(p: StrengthProfile): string {
  if (p.shape === 'peaked') return `You stand out for ${p.peaks.map((x) => x.label.toLowerCase()).join(' and ')}.`
  if (p.shape === 'balanced') return `You’re strong across the board: ${p.broad.slice(0, 4).map((x) => x.label.toLowerCase()).join(', ')}. Sell your range.`
  return 'We don’t have enough evidence yet to name your standout strengths.'
}

// ── What each kind of role leans on ─────────────────────────────────────────
// Editorial: the strengths a pivot-map role most depends on, so a path or job
// can say "plays to your strength" or "leans on something that isn't a
// strength yet". Keyed by pivot-map role.
const LEANS: Record<StrengthKey, string[]> = {
  influence: ['recruiter', 'account_executive', 'business_development', 'partnerships', 'search_firm_consultant', 'sales_development', 'customer_success', 'talent_acquisition', 'hrbp', 'account_manager', 'account_management', 'sales', 'product_marketing', 'community_management', 'developer_relations', 'fundraising', 'solutions_consulting', 'healthcare_sales', 'government_contracting', 'teaching', 'customer_education', 'management_consulting', 'consulting'],
  leadership: ['operations_management', 'retail_management', 'hospitality', 'people_operations', 'operations', 'military_government'],
  composure: ['customer_service', 'nursing_clinical', 'hospitality', 'event_management', 'security_risk', 'support_operations', 'retail_management', 'sales_development'],
  execution: ['project_management', 'project_program', 'program_management', 'technical_program_management', 'implementation', 'logistics_supply_chain', 'operations', 'admin_ea', 'event_management', 'procurement', 'revenue_operations', 'marketing_operations'],
  judgment: ['corporate_development', 'investment', 'product_management', 'product', 'compliance', 'legal', 'contracts_management', 'fpa', 'management_consulting', 'consulting', 'security_risk', 'clinical_operations', 'hrbp'],
  expertise: ['investment', 'engineering', 'data_analytics', 'data_analyst', 'hris', 'compensation', 'people_analytics', 'finance_accounting', 'legal', 'clinical_informatics', 'instructional_design', 'design', 'ux_research', 'fpa'],
  collaboration: ['program_management', 'product_operations', 'people_operations', 'implementation', 'learning_development', 'clinical_operations', 'business_analyst'],
  adaptability: ['product_management', 'product', 'business_development', 'community_management', 'customer_success', 'management_consulting', 'consulting', 'implementation'],
  scale: ['operations_management', 'procurement', 'fpa', 'program_management'],
}

export function roleLeansOn(roleKey: string): StrengthKey[] {
  return (Object.keys(LEANS) as StrengthKey[]).filter((k) => LEANS[k].includes(roleKey))
}

export type StrengthKeys = { peaks: StrengthKey[]; weak: StrengthKey[] }
export const strengthKeys = (p: StrengthProfile): StrengthKeys => ({ peaks: p.peaks.map((x) => x.key), weak: p.weakSpots.map((x) => x.key) })

// One line each for what a role plays to and what it would expose.
export function strengthNotes(keys: StrengthKeys | null | undefined, roleKey: string): { plays: string | null; exposes: string | null; delta: number } {
  if (!keys) return { plays: null, exposes: null, delta: 0 }
  const leans = roleLeansOn(roleKey)
  const label = (k: StrengthKey) => STRENGTHS.find((s) => s.key === k)!.label.toLowerCase()
  const plays = leans.filter((k) => keys.peaks.includes(k))
  const exposes = leans.filter((k) => keys.weak.includes(k))
  return {
    plays: plays.length ? `Plays to your strength: ${plays.map(label).join(' and ')}.` : null,
    exposes: exposes.length ? `Leans on ${exposes.map(label).join(' and ')}, which isn’t a strength for you yet. Go in with a plan for it, or pick a path that doesn’t.` : null,
    delta: 0.08 * plays.length - 0.08 * exposes.length,
  }
}
