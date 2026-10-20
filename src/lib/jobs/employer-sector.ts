// Employer sector: who the employer is — a private company, a government
// (federal, state, local), a nonprofit, or an academic institution (universities,
// colleges, schools). The crawler derives it from explicit signals only
// (ncrawl/sector.py: USAJOBS and state/local government sources, IRS NTEE / 990
// filers, IPEDS institutions and school boards); everything else is private.
// Members can turn sectors off: the board, and every job email, then leave those
// jobs out (hiddenEmployerSectors on CandidateProfile). Pure — no database.

export const EMPLOYER_SECTORS = ['private', 'government', 'nonprofit', 'academia'] as const
export type EmployerSector = (typeof EMPLOYER_SECTORS)[number]

export const EMPLOYER_SECTOR_LABEL: Record<EmployerSector, string> = {
  private: 'Private',
  government: 'Government',
  nonprofit: 'Nonprofit',
  academia: 'Academia',
}
export const EMPLOYER_SECTOR_HINT: Record<EmployerSector, string> = {
  private: 'Companies',
  government: 'Federal, state and local government',
  nonprofit: 'Nonprofits and charities',
  academia: 'Universities, colleges and schools',
}

export const isEmployerSector = (v: unknown): v is EmployerSector => (EMPLOYER_SECTORS as readonly unknown[]).includes(v)

/** A job's sector; a job the crawler didn't place (or a direct posting) reads as private. */
export function sectorOf(value: string | null | undefined): EmployerSector {
  return isEmployerSector(value) ? value : 'private'
}

/** Sanitised list of sectors (order kept, duplicates and unknown values dropped). */
export function parseSectors(values: readonly unknown[] | null | undefined): EmployerSector[] {
  const out: EmployerSector[] = []
  for (const v of values ?? []) if (isEmployerSector(v) && !out.includes(v)) out.push(v)
  return out
}

/** The `sectors` URL parameter: the sectors shown, comma-separated. Absent = the member's saved choice. */
export function parseSectorsParam(raw: string | null | undefined): EmployerSector[] | null {
  if (raw === null || raw === undefined) return null
  if (raw === 'none') return []
  return parseSectors(raw.split(','))
}

/** Shown sectors -> URL value; null (no parameter) when every sector is on. */
export function sectorsParam(shown: readonly EmployerSector[]): string | null {
  const s = parseSectors(shown)
  if (s.length === EMPLOYER_SECTORS.length) return null
  if (s.length === 0) return 'none'
  return EMPLOYER_SECTORS.filter((x) => s.includes(x)).join(',')
}

export const shownFromHidden = (hidden: readonly string[] | null | undefined): EmployerSector[] =>
  EMPLOYER_SECTORS.filter((s) => !(hidden ?? []).includes(s))
export const hiddenFromShown = (shown: readonly EmployerSector[]): EmployerSector[] => EMPLOYER_SECTORS.filter((s) => !shown.includes(s))

/** A predicate for board rows: keeps jobs whose sector is shown. Null when every sector is on (nothing to filter). */
export function sectorKeep(hidden: readonly string[] | null | undefined): ((p: { employerSector: string | null }) => boolean) | null {
  const off = new Set(parseSectors(hidden ?? []))
  if (off.size === 0) return null
  return (p) => !off.has(sectorOf(p.employerSector))
}
