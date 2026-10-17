import {
  COMPANY_SIZE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  HIGHEST_LEVEL_OPTIONS,
  PRIMARY_FUNCTION_OPTIONS,
} from '@/lib/constants/onboarding'

// Candidate profile fields that hold one value from a fixed option list are
// plain strings in the database, and every reader compares them with ===
// against the canonical option ('Director', 'remote', 'Product'). A profile
// stored as codes instead ('DIRECTOR', 'REMOTE', 'PRODUCT_MANAGEMENT') was
// recognised by nothing — the job-fit scorer gave that member zero fits.
//
// These helpers map a stored value onto the canonical option: first by
// ignoring case, spaces and punctuation ('C_SUITE' -> 'C-Suite'), then
// through a short explicit alias list for codes that don't spell the option
// ('INDIVIDUAL_CONTRIBUTOR' -> 'IC'). Anything else is returned unchanged
// (trimmed) — never guessed. Used on write (onboarding, Search Strategy) and
// on read (the job-fit scorer), so an old row and a new one read the same.

const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9+]/g, '')

function canonical<T extends string>(
  value: string | null | undefined,
  options: readonly T[],
  aliases: Record<string, T>
): T | string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const k = key(trimmed)
  return options.find((o) => key(o) === k) ?? aliases[k] ?? trimmed
}

// Keys are already passed through key() — lowercase, no punctuation.
const FUNCTION_ALIASES: Record<string, (typeof PRIMARY_FUNCTION_OPTIONS)[number]> = {
  productmanagement: 'Product',
  hr: 'Human Resources',
  humanresourceshr: 'Human Resources',
  people: 'Human Resources',
  peopleoperations: 'Human Resources',
  dataanalytics: 'Data & Analytics',
  dataandanalytics: 'Data & Analytics',
  customersuccess: 'Customer Success',
  executiveleadership: 'Executive Leadership',
  generalmanagement: 'Executive Leadership',
}

const LEVEL_ALIASES: Record<string, (typeof HIGHEST_LEVEL_OPTIONS)[number]> = {
  individualcontributor: 'IC',
  seniorindividualcontributor: 'IC',
  seniormanager: 'Manager',
  seniordirector: 'Director',
  vicepresident: 'VP',
  svp: 'VP',
  evp: 'VP',
  csuite: 'C-Suite',
  clevel: 'C-Suite',
  executive: 'C-Suite',
}

const REMOTE_OPTIONS = ['remote', 'hybrid', 'onsite', 'flexible'] as const
const REMOTE_ALIASES: Record<string, (typeof REMOTE_OPTIONS)[number]> = {
  inoffice: 'onsite',
  inperson: 'onsite',
  office: 'onsite',
  fullyremote: 'remote',
  remoteonly: 'remote',
  any: 'flexible',
  nopreference: 'flexible',
}

const COMPANY_SIZE_ALIASES: Record<string, (typeof COMPANY_SIZE_OPTIONS)[number]> = {
  small: '1-50',
  startup: '1-50',
  midsize: '50-500',
  mid: '50-500',
  medium: '50-500',
  large: '500+',
  enterprise: '500+',
}

const COMPANY_STAGE_VALUES = COMPANY_STAGE_OPTIONS.map((o) => o.value)
const COMPANY_STAGE_ALIASES: Record<string, (typeof COMPANY_STAGE_VALUES)[number]> = {
  nonprofit: 'non-profit',
  gov: 'government',
  public: 'enterprise',
}

export function normalizeFunctionValue(value: string | null | undefined): string | null {
  return canonical(value, PRIMARY_FUNCTION_OPTIONS, FUNCTION_ALIASES)
}

export function normalizeLevelValue(value: string | null | undefined): string | null {
  return canonical(value, HIGHEST_LEVEL_OPTIONS, LEVEL_ALIASES)
}

export function normalizeRemotePreferenceValue(value: string | null | undefined): string | null {
  return canonical(value, REMOTE_OPTIONS, REMOTE_ALIASES)
}

export function normalizeCompanySizeValue(value: string | null | undefined): string | null {
  return canonical(value, COMPANY_SIZE_OPTIONS, COMPANY_SIZE_ALIASES)
}

export function normalizeCompanyStageValue(value: string | null | undefined): string | null {
  return canonical(value, COMPANY_STAGE_VALUES, COMPANY_STAGE_ALIASES)
}

// A target role stored as a code ('INDIVIDUAL_CONTRIBUTOR') is not a title
// anyone could match against — read it as no stated target rather than a
// very specific one nothing on the board shares a word with.
export function normalizeTargetRoleTypeValue(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(trimmed) ? null : trimmed
}

type NormalizableFields = {
  primaryFunction?: string | null
  secondaryFunction?: string | null
  targetFunction?: string | null
  highestLevelReached?: string | null
  remotePreference?: string | null
  targetCompanySize?: string | null
  targetCompanyStage?: string | null
  targetRoleType?: string | null
}

/**
 * The same profile with every option-list field mapped to its canonical
 * value. Returns the input object itself when nothing changes, so it is
 * free to call on every scoring pass.
 */
export function normalizeCandidateProfileFields<T extends NormalizableFields>(c: T): T {
  const next: NormalizableFields = {}
  let changed = false
  const set = <K extends keyof NormalizableFields>(k: K, fn: (v: string | null | undefined) => string | null) => {
    if (!(k in c)) return
    const before = c[k]
    const after = fn(before)
    if (after !== (before ?? null) && !(before === undefined && after === null)) {
      next[k] = after
      changed = true
    }
  }
  set('primaryFunction', normalizeFunctionValue)
  set('secondaryFunction', normalizeFunctionValue)
  set('targetFunction', normalizeFunctionValue)
  set('highestLevelReached', normalizeLevelValue)
  set('remotePreference', normalizeRemotePreferenceValue)
  set('targetCompanySize', normalizeCompanySizeValue)
  set('targetCompanyStage', normalizeCompanyStageValue)
  set('targetRoleType', normalizeTargetRoleTypeValue)
  return changed ? { ...c, ...next } : c
}
