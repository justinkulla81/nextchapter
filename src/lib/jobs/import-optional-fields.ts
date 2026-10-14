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
