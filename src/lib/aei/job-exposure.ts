// AI exposure from the Anthropic Economic Index (AEI): the one signal the job board shows per job.
// Pure and client-safe; the data lives in AeiOccupation (prisma/manual/2026-10-22-aei-exposure.sql),
// built from the AEI release on Hugging Face (scripts/careers/aei/).
//
// What it measures: how much people use Claude for an occupation's tasks — the share of the
// occupation's O*NET tasks that show up in Claude conversations with meaningful use (at least
// 0.01% of conversations in the release). It is NOT a forecast of job loss: never say "at risk".
//
// Fixed cutoffs on that task coverage (documented, never tuned per run):
//   High   >= 50%: AI is used on at least half of the occupation's tasks
//   Medium >= 25%: at least a quarter — the AEI's own bar for meaningful use across an occupation
//          (Anthropic Economic Index, February 2025: occupations using AI for at least a quarter
//          of their tasks)
//   Low    <  25%
// On the live board (October 2026) that is about 11% High, 32% Medium, 57% Low.
//
// Not the same thing as the board's AI / Non-AI choice (ai-view.ts: the posting asks for an AI
// skill) or ExclusiveJobPosting.aiExposed (AI named in the role text). Those say whether a job asks
// for AI; this says how much AI is already used on the occupation's work.

export const AEI_SOURCE_URL = 'https://www.anthropic.com/economic-index'
export const AEI_LABEL = 'AI exposure (Anthropic Economic Index)'
export const AEI_RELEASE = 'release_2026_06_26'
export const AEI_RELEASE_LABEL = 'June 2026 release (April–May 2026 usage)'

export type ExposureLevel = 'high' | 'medium' | 'low'

export const EXPOSURE_CUTOFFS = { high: 50, medium: 25 } as const
/** Meaningful use: a task's share of conversations in the release, in percent. */
export const TASK_USE_THRESHOLD_PCT = 0.01

export const EXPOSURE_LEVEL_LABEL: Record<ExposureLevel, string> = { high: 'High', medium: 'Medium', low: 'Low' }
export const EXPOSURE_RANK: Record<ExposureLevel, number> = { high: 3, medium: 2, low: 1 }

export function exposureLevelFor(taskCoveragePct: number | null | undefined): ExposureLevel | null {
  if (taskCoveragePct === null || taskCoveragePct === undefined || !Number.isFinite(taskCoveragePct)) return null
  if (taskCoveragePct >= EXPOSURE_CUTOFFS.high) return 'high'
  if (taskCoveragePct >= EXPOSURE_CUTOFFS.medium) return 'medium'
  return 'low'
}

export function isExposureLevel(v: unknown): v is ExposureLevel {
  return v === 'high' || v === 'medium' || v === 'low'
}

export type CollabMode = 'automates' | 'augments' | 'both'

/** Mostly automation vs augmentation: a 10-point band around even is "both". */
export function collabModeFor(automationPct: number | null | undefined, augmentationPct: number | null | undefined): CollabMode | null {
  if (automationPct == null || augmentationPct == null) return null
  const total = automationPct + augmentationPct
  if (!(total > 0)) return null
  const share = (100 * automationPct) / total
  if (share >= 55) return 'automates'
  if (share <= 45) return 'augments'
  return 'both'
}

export const COLLAB_LINE: Record<CollabMode, string> = {
  automates: 'AI mostly automates this work: people hand it whole tasks to finish.',
  augments: 'AI mostly augments this work: people use it alongside them, to draft, check and learn.',
  both: 'AI both automates and augments this work, in about equal measure.',
}

/** The one-line summary in the job drawer. */
export function exposureSummary(level: ExposureLevel, tasksUsed: number, taskCount: number): string {
  const lead =
    taskCount > 0
      ? `${tasksUsed} of this occupation's ${taskCount} tasks show up in Claude conversations`
      : 'Read from similar occupations (O*NET lists no tasks for this one)'
  if (level === 'high') return `${lead}. This is among the work most exposed to AI change.`
  if (level === 'medium') return `${lead}. AI is changing parts of this work.`
  return `${lead}. Little of this work is done with AI today.`
}

// ── Which occupation a job is read as ──────────────────────────────────────
// The crawler's O*NET title match (socCode) when it has one. It deliberately leaves vague titles
// ("Director", "Team Leader") unmatched, so for AEI those are read from the job's function and
// level instead: a fixed allowlist below, never a model call. 'default' = no function either.

export type AeiSocSource = 'title' | 'function' | 'default'

const MANAGER_LEVELS = new Set(['MANAGER', 'SR_MANAGER', 'DIRECTOR', 'HEAD', 'VP', 'EVP_SVP', 'C_SUITE', 'CHIEF_OF_STAFF', 'PARTNER', 'BOARD', 'SCHOOL_LEADER'])
const EXEC_LEVELS = new Set(['C_SUITE', 'EVP_SVP', 'BOARD'])

const SOFTWARE = /\b(software|developer|devops|sre|site reliability|cloud|platform|data|machine learning|ml|ai|frontend|front end|backend|back end|full stack|fullstack|mobile|ios|android|web|application|qa|test|it|salesforce|sap|oracle|workday|servicenow|network|systems?|solutions?)\b/i
const ACCOUNTING = /\b(accounting|accountants?|audit|auditors?|tax|payroll|billing|accounts? (payable|receivable)|ap|ar|controller|bookkeep\w*|reconcil\w*)\b/i
const SUPPORT = /\b(support|service|help ?desk|call center|contact center)\b/i
const PARALEGAL = /\b(paralegal|legal assistant|legal secretary)\b/i
const COMPLIANCE = /\b(compliance|regulatory|risk)\b/i
const NURSE = /\b(nurse|rn|lpn|nursing)\b/i

/** [manager-level SOC, individual-contributor SOC] per function label, lowercased. */
function proxyFor(fn: string, title: string, manager: boolean, exec: boolean): string {
  const t = title
  switch (fn) {
    case 'engineering':
      return SOFTWARE.test(t) ? (manager ? '11-3021.00' : '15-1252.00') : manager ? '11-9041.00' : '17-2199.00'
    case 'data & analytics':
      return manager ? '11-3021.00' : '15-2051.00'
    case 'security':
      return manager ? '11-3021.00' : '15-1212.00'
    case 'product':
      return '11-2021.00'
    case 'design':
      return '15-1255.00'
    case 'finance':
      return ACCOUNTING.test(t) ? (manager ? '11-3031.00' : '13-2011.00') : manager ? '11-3031.00' : '13-2051.00'
    case 'investment':
      return manager ? '11-3031.00' : '13-2051.00'
    case 'sales':
      return manager ? '11-2022.00' : '41-3091.00'
    case 'customer success':
      return manager ? '11-2022.00' : SUPPORT.test(t) ? '43-4051.00' : '41-3091.00'
    case 'marketing':
      return manager ? '11-2021.00' : '13-1161.00'
    case 'human resources':
      return manager ? '11-3121.00' : '13-1071.00'
    case 'legal':
      if (PARALEGAL.test(t)) return '23-2011.00'
      if (COMPLIANCE.test(t)) return manager ? '11-9199.02' : '13-1041.00'
      return '23-1011.00'
    case 'administration':
      return manager ? '11-3012.00' : '43-6011.00'
    case 'executive leadership':
      return exec ? '11-1011.00' : '11-1021.00'
    case 'operations':
    case 'general':
      return exec ? '11-1011.00' : manager ? '11-1021.00' : '13-1199.00'
    case 'clinical':
      return manager ? '11-9111.00' : NURSE.test(t) ? '29-1141.00' : '29-9099.00'
    case 'programs':
      return manager && exec ? '11-1021.00' : '13-1082.00'
    case 'strategy':
      return exec ? '11-1021.00' : '13-1111.00'
    case 'fundraising & development':
      return manager ? '11-2033.00' : '13-1131.00'
    case 'research':
      return manager ? '11-9121.00' : '19-1029.00'
    case 'academic':
      return manager ? '11-9033.00' : '25-1199.00'
    default:
      return ''
  }
}

/**
 * The O*NET-SOC occupation a job is read as for AEI. `fn` is the stored function label
 * (targetFunction) or the board's reading of the title (inferFunctionFromTitle).
 */
export function aeiSocFor(job: { socCode: string | null; title: string; fn: string | null; level: string | null }): { soc: string; source: AeiSocSource } {
  if (job.socCode) return { soc: job.socCode, source: 'title' }
  const level = (job.level ?? '').toUpperCase()
  const manager = MANAGER_LEVELS.has(level)
  const exec = EXEC_LEVELS.has(level)
  const fn = (job.fn ?? '').trim().toLowerCase()
  const proxy = fn ? proxyFor(fn, job.title ?? '', manager, exec) : ''
  if (proxy) return { soc: proxy, source: 'function' }
  return { soc: exec ? '11-1011.00' : manager ? '11-1021.00' : '13-1199.00', source: 'default' }
}

/**
 * Looks an occupation up with fallbacks for codes outside O*NET 31.0: the exact code, then the
 * detailed SOC (".00"), then any occupation in the same detailed SOC.
 */
export function lookupOccupation<T>(byCode: ReadonlyMap<string, T>, soc: string | null | undefined): T | null {
  if (!soc) return null
  const exact = byCode.get(soc)
  if (exact) return exact
  const six = soc.slice(0, 7)
  const base = byCode.get(`${six}.00`)
  if (base) return base
  for (const [code, v] of byCode) if (code.startsWith(six)) return v
  return null
}

// ── What the job drawer shows ──────────────────────────────────────────────

export interface AiExposureView {
  level: ExposureLevel
  /** The O*NET occupation the job is read as. */
  occupation: string
  source: AeiSocSource
  tasksUsed: number
  taskCount: number
  collab: CollabMode | null
  automationPct: number | null
  augmentationPct: number | null
  /** The occupation's tasks people use Claude for most, plain text (up to three). */
  topTasks: string[]
}

export function aiExposureView(
  row: {
    title: string
    exposureLevel: ExposureLevel
    tasksUsed: number
    taskCount: number
    automationPct: number | null
    augmentationPct: number | null
    topTasks: { text: string }[]
  },
  source: AeiSocSource
): AiExposureView {
  return {
    level: row.exposureLevel,
    occupation: row.title,
    source,
    tasksUsed: row.tasksUsed,
    taskCount: row.taskCount,
    collab: collabModeFor(row.automationPct, row.augmentationPct),
    automationPct: row.automationPct,
    augmentationPct: row.augmentationPct,
    topTasks: row.topTasks.slice(0, 3).map((t) => t.text),
  }
}

export const AEI_SOURCE_NOTE: Record<AeiSocSource, string> = {
  title: 'Read from the job title.',
  function: 'Estimated from the job’s function and level (the title alone did not name an occupation).',
  default: 'Estimated from the job’s level only (the title did not name an occupation or function).',
}
