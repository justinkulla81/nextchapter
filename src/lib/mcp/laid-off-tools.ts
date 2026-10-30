import 'server-only'
import catalog from '@/lib/benefits/catalog.json'
import { GOAL_OF, GOAL_LABEL, publicShowable, type Goal } from '@/lib/benefits/match'
import { CATEGORY_LABELS, type BenefitProgramRow } from '@/lib/benefits/types'
import { STATE_UI, UI_LAST_VERIFIED } from '@/lib/data/state-ui'
import { searchOccupationTitles } from '@/lib/careers/candidate-occupation'
import { loadOccupationCheck } from '@/lib/ai-check/load'
import { checkPath } from '@/lib/ai-check/slug'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, EXPOSURE_WHY, RETRAINING_LINE, soc6Of } from '@/lib/skills/ai-exposure'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { SITE_URL } from '@/lib/seo/facts'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

// Read-only tools for "I just got laid off, what now?", answered from the same data as the public pages. Each result names
// its source and an as-of date. Nothing here calls a metered service.

const GOALS = ['support', 'move', 'retrain', 'tax', 'learn'] as const

export const LAID_OFF_TOOLS = [
  {
    name: 'unemployment_benefits_by_state',
    description:
      'Unemployment insurance basics for one U.S. state: the state agency and where to file, maximum and minimum weekly benefit, maximum weeks, whether there is a waiting week, how severance and pay in lieu of notice are treated, and the work-search rule. Each fact carries its official source and the date it was checked. Use it to answer "can I get unemployment after a layoff in [state]?".',
    inputSchema: {
      type: 'object',
      properties: { state: { type: 'string', description: 'Two-letter U.S. state code, e.g. "TX".' } },
      required: ['state'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'laid_off_benefits_and_programs',
    description:
      'Verified programs that help a laid-off professional: health-coverage and cost relief while out of work, relocation money, retraining and tuition funds, tax credits, and free courses. Returns programs open to anyone in the state plus nationwide ones, each with the amount, who is eligible, status, the official page and the date it was last checked. Only programs checked against their official page are returned; programs restricted to a group or profession are left out. Filter by goal to ask for retraining or relocation funding.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Two-letter U.S. state code. State programs for that state come first, then nationwide programs.' },
        goal: { type: 'string', enum: [...GOALS], description: 'support = help while out of work, move = relocation money, retrain = tuition and training funds, tax = credits and deductions, learn = free courses. Omit for all.' },
        limit: { type: 'integer', description: 'Most programs to return (1 to 25, default 10).' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'ai_exposure_for_job_title',
    description:
      'How much of a job’s work AI is already used for, from the Anthropic Economic Index, matched from a plain job title. Returns the matched occupation, the exposure share and band, median pay, projected growth, yearly openings, related jobs that pay more or are less exposed, and a link to the full check. It measures observed use now; it is not a forecast of job loss.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string', description: 'A job title, e.g. "marketing manager" or "accountant".' } },
      required: ['title'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const

export const LAID_OFF_TOOL_NAMES: readonly string[] = LAID_OFF_TOOLS.map((t) => t.name)

const upper = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase() : '')
const isState = (s: string) => (ALL_STATE_CODES as readonly string[]).includes(s)
const STATE_ERROR = { error: 'state must be a two-letter U.S. state code, such as TX.' }

export function unemploymentBenefitsByState(args: Record<string, unknown>) {
  const code = upper(args.state)
  const ui = STATE_UI[code]
  if (!isState(code) || !ui) return STATE_ERROR
  const fact = <T>(f: { value: T | null; source: string | null; asOf: string | null; note?: string }) => ({ value: f.value, source: f.source, asOf: f.asOf, ...(f.note ? { note: f.note } : {}) })
  return {
    state: code,
    stateName: stateName(code),
    agency: fact(ui.agencyName),
    fileClaim: fact(ui.fileUrl),
    maxWeeklyBenefitUsd: fact(ui.maxWeeklyBenefit),
    minWeeklyBenefitUsd: fact(ui.minWeeklyBenefit),
    maxWeeks: fact(ui.maxWeeks),
    weeksDependOnStateUnemploymentRate: fact(ui.durationVaries),
    waitingWeek: fact(ui.waitingWeek),
    severance: { ...fact(ui.severance), treatment: ui.severance.treatment },
    payInLieuOfNotice: { ...fact(ui.payInLieuOfNotice), treatment: ui.payInLieuOfNotice.treatment },
    workSearchRule: fact(ui.workSearch),
    notes: ui.notes,
    asOf: UI_LAST_VERIFIED,
    source: `${SITE_URL}/unemployment-benefits/${stateSlug(code)}`,
  }
}

const rows = (catalog as unknown as { rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }).rows
const BUILT_AT = (catalog as unknown as { builtAt: string }).builtAt.slice(0, 10)
const programs = rows.map((r) => ({ ...r, checkedAt: r.checkedAt ? new Date(r.checkedAt) : null }) as BenefitProgramRow).filter((r) => publicShowable(r) && (r.status === 'OPEN' || r.status === 'ROLLING'))

export function lookupPrograms(args: Record<string, unknown>) {
  const stateRaw = upper(args.state)
  if (stateRaw && !isState(stateRaw)) return STATE_ERROR
  const goal = typeof args.goal === 'string' && (GOALS as readonly string[]).includes(args.goal) ? (args.goal as Goal) : null
  const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.min(Math.max(Math.floor(args.limit), 1), 25) : 10
  const pool = programs.filter((r) => (!goal || GOAL_OF[r.category] === goal) && (r.scope === 'NATIONAL' ? true : !!stateRaw && r.state === stateRaw && r.scope === 'STATE'))
  // The state's own programs first, then nationwide; within each, the ones with a stated amount first.
  const rank = (r: BenefitProgramRow) => (r.scope === 'NATIONAL' ? 1 : 0) * 2 + (r.amount ? 0 : 1)
  const sorted = [...pool].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  return {
    state: stateRaw || null,
    goal,
    goalMeaning: goal ? GOAL_LABEL[goal].title : null,
    matches: pool.length,
    programs: sorted.slice(0, limit).map((r) => ({
      name: r.name,
      provider: r.provider,
      coverage: r.scope === 'NATIONAL' ? 'Nationwide' : stateName(r.state ?? ''),
      goal: GOAL_OF[r.category],
      category: CATEGORY_LABELS[r.category],
      amount: r.amount,
      eligibility: r.eligibility,
      status: r.status,
      programPage: r.url,
      applyPage: r.applyUrl ?? r.url,
      lastCheckedOn: r.checkedAt ? r.checkedAt.toISOString().slice(0, 10) : null,
    })),
    asOf: BUILT_AT,
    source: `${SITE_URL}/funding`,
  }
}

export async function aiExposureForJobTitle(args: Record<string, unknown>) {
  const title = typeof args.title === 'string' ? args.title.trim().slice(0, 80) : ''
  if (title.length < 2) return { error: 'title must be a job title, such as "marketing manager".' }
  const [found, map] = await Promise.all([searchOccupationTitles(title), loadExposureMap()])
  const hit = found.find((c) => map.has(soc6Of(c.socCode)))
  if (!hit) return { error: 'No match for that title. Try the plain name of the job, like "nurse manager".', source: `${SITE_URL}/tools/ai-job-check` }
  const soc6 = soc6Of(hit.socCode)
  const check = await loadOccupationCheck(soc6)
  if (!check) return { error: 'No AI exposure measure for that occupation yet.', source: `${SITE_URL}/tools/ai-job-check` }
  const e = check.exposure
  return {
    matchedOccupation: e.title,
    soc: soc6,
    searchedTitle: title,
    aiExposure: { share: Math.round(e.score * 100) / 100, band: BAND_LABEL[e.band], meaning: EXPOSURE_WHY },
    whatItMeansForYourSearch: RETRAINING_LINE[check.need],
    medianPayUsd: check.medianWage,
    projectedGrowthPct: check.growthPct,
    openingsPerYear: check.annualOpenings,
    relatedJobsWorthConsidering: check.bets.map((b) => ({
      title: b.title,
      reasons: b.reasons.map((x) => (x === 'pays_more' ? 'pays more' : 'less exposed to AI')),
      aiExposureShare: b.exposure == null ? null : Math.round(b.exposure * 100) / 100,
      medianPayUsd: b.medianWage,
      page: `${SITE_URL}${checkPath(b.title, b.soc6)}`,
    })),
    skillsToBuild: check.skillsToBuild,
    page: `${SITE_URL}${checkPath(e.title, soc6)}`,
    asOf: AI_EXPOSURE_SOURCE.released,
    source: { name: AI_EXPOSURE_SOURCE.name, url: AI_EXPOSURE_SOURCE.url, released: AI_EXPOSURE_SOURCE.released, license: 'CC BY 4.0' },
  }
}

export async function callLaidOffTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'unemployment_benefits_by_state') return unemploymentBenefitsByState(args)
  if (name === 'laid_off_benefits_and_programs') return lookupPrograms(args)
  if (name === 'ai_exposure_for_job_title') return aiExposureForJobTitle(args)
  return null
}
