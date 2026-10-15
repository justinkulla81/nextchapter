// Flags figures stored in code (pitch facts, marketing message figures) that a
// new report edition no longer contains, so they are not quoted stale. Pure.

/** The searchable core of a displayed value: '$1.396B' -> '1.396', '~546,000' -> '546,000', '+1.5 pts' -> '1.5'. */
export function factCore(value: string): string | null {
  const core = value
    .replace(/[~≈+−-]/g, '')
    .replace(/\$/g, '')
    .replace(/\s*(pts?|points?)\b/gi, '')
    .replace(/%$/, '')
    .replace(/[BMK]$/, '')
    .trim()
  return /\d/.test(core) ? core : null
}

export interface FactToCheck {
  source: string // where it is stored, e.g. 'pitch h-midcareer'
  label: string
  value: string
}

export interface FactCheckResult {
  found: FactToCheck[]
  missing: FactToCheck[]
  unchecked: FactToCheck[] // no digits to search for
}

export function checkFacts(facts: FactToCheck[], reportText: string): FactCheckResult {
  const text = reportText.replace(/\s+/g, ' ')
  const out: FactCheckResult = { found: [], missing: [], unchecked: [] }
  for (const f of facts) {
    const core = factCore(f.value)
    if (!core) out.unchecked.push(f)
    else if (text.includes(core)) out.found.push(f)
    else out.missing.push(f)
  }
  return out
}
