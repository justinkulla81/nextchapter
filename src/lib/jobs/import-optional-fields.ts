// The one-board fields the ncrawl import may send (derive.py): employment type, pay
// period, pay source, work arrangement and compensation type. All optional and
// backward compatible — only fields the sender actually included are returned, so
// an older exporter neither erases stored values nor makes every row look changed.

export const IMPORT_OPTIONAL_FIELDS = ['employmentType', 'payPeriod', 'paySource', 'workArrangement', 'compensationType'] as const
export type ImportOptionalField = (typeof IMPORT_OPTIONAL_FIELDS)[number]

/** Short lowercase tokens only ("Full-Time" → "full_time"); anything else is stored as null. */
export function importToken(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return /^[a-z_]{1,32}$/.test(t) ? t : null
}

export function importOptionalFields(job: Partial<Record<ImportOptionalField, unknown>>): Partial<Record<ImportOptionalField, string | null>> {
  const out: Partial<Record<ImportOptionalField, string | null>> = {}
  for (const k of IMPORT_OPTIONAL_FIELDS) if (k in job && job[k] !== undefined) out[k] = importToken(job[k])
  return out
}

// Location parts, source ids and repost/description keys (ncrawl derive.py). Same
// contract as above: a field the sender left out is not returned, so it is neither
// erased nor counted as a change; a malformed value is stored as null.
export interface ImportSpecInput {
  locationCity?: unknown
  locationState?: unknown
  locationCountry?: unknown
  locations?: unknown
  externalJobId?: unknown
  requisitionId?: unknown
  repostKey?: unknown
  descHash?: unknown
  socCode?: unknown
  socTitle?: unknown
}

export interface ImportSpecFields {
  locationCity?: string | null
  locationState?: string | null
  locationCountry?: string | null
  locationStates?: string[]
  externalJobId?: string | null
  requisitionId?: string | null
  repostKey?: string | null
  descHash?: string | null
  socCode?: string | null
  socTitle?: string | null
}

/** Trimmed single-line text up to `max` chars (longer is cut), else null. */
export function importText(v: unknown, max: number): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const t = String(v).replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

/** A plain place name ("St. Louis", "Winston-Salem"); anything else is null. */
function cityName(v: unknown): string | null {
  const t = importText(v, 60)
  return t && /^[A-Za-z][A-Za-z .'-]{0,58}[A-Za-z.]$/.test(t) ? t : null
}

/** Two-letter code, uppercased, when it is one of `allowed` (or any A–Z pair). */
function code(v: unknown, allowed?: ReadonlySet<string>): string | null {
  const t = importText(v, 8)?.toUpperCase()
  if (!t || !/^[A-Z]{2}$/.test(t)) return null
  return !allowed || allowed.has(t) ? t : null
}

/**
 * Every US state the posting names: the primary state plus whatever each listed
 * location resolves to (statesFromLocation, injected so this file stays pure of
 * the pay module). Order: primary first, then as listed; no duplicates.
 */
export function importSpecFields(
  job: ImportSpecInput,
  statesOf: (location: string) => string[],
  stateCodes: ReadonlySet<string>
): ImportSpecFields {
  const out: ImportSpecFields = {}
  const has = (k: keyof ImportSpecInput) => k in job && job[k] !== undefined
  if (has('locationState')) out.locationState = code(job.locationState, stateCodes)
  if (has('locationCity')) out.locationCity = out.locationState === null ? null : cityName(job.locationCity)
  if (has('locationCountry')) out.locationCountry = code(job.locationCountry)
  if (has('locations') || has('locationState')) {
    const states: string[] = []
    const add = (s: string | null | undefined) => {
      if (s && stateCodes.has(s) && !states.includes(s)) states.push(s)
    }
    add(out.locationState ?? code(job.locationState, stateCodes))
    if (Array.isArray(job.locations)) {
      for (const l of job.locations.slice(0, 50)) {
        const text = importText(l, 200)
        if (text) for (const s of statesOf(text)) add(s)
      }
    }
    out.locationStates = states
  }
  if (has('externalJobId')) out.externalJobId = importText(job.externalJobId, 200)
  if (has('requisitionId')) out.requisitionId = importText(job.requisitionId, 200)
  if (has('repostKey')) out.repostKey = importText(job.repostKey, 64)
  if (has('descHash')) out.descHash = importText(job.descHash, 64)
  // O*NET-SOC code ("13-2051.00") and its title; a malformed code drops both.
  if (has('socCode') || has('socTitle')) {
    const soc = importText(job.socCode, 10)
    const ok = soc !== null && /^\d{2}-\d{4}\.\d{2}$/.test(soc)
    out.socCode = ok ? soc : null
    out.socTitle = ok ? importText(job.socTitle, 150) : null
  }
  return out
}
