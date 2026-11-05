/**
 * Pure logic behind the generated /vs/<competitor> "alternative" pages.
 *
 * Rules (CLAUDE.md, docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md):
 *  - Our side comes only from the capability catalog (src/lib/vision/capabilities.ts), whose BUILT and PARTIAL rows
 *    each point at code in this repo. A PLANNED row is never described as something we do.
 *  - The competitor side comes only from matrix cells that have a status, an evidence URL on their own or a named
 *    source, and a check date. Anything else is left off the page.
 *  - A page is indexable only with enough cited cells and a recent check; otherwise it still resolves, marked noindex.
 */
import { CAPABILITIES, type Capability } from '@/lib/vision/capabilities'
import { areaLabel } from '@/lib/vision/competitor-areas'

export const MIN_CITED_CELLS = 3
export const MAX_CHECK_AGE_DAYS = 365
export const MAX_OURS_EXTRA = 8

export type CellAnswer = 'YES' | 'PARTIAL' | 'NO'

export interface CitedCell {
  capabilityKey: string
  status: CellAnswer
  note: string | null
  evidenceUrl: string
  checkedAt: Date
}

export interface AlternativeCompetitor {
  name: string
  url: string | null
  segment: string | null
  areas: string[]
  relationship: string
  status: string
}

export interface AlternativeRow {
  capabilityKey: string
  name: string
  areaLabel: string
  theirs: CellAnswer
  theirNote: string | null
  evidenceUrl: string
  checkedAt: Date
  /** What NextChapter does for this capability; null when it is not built (the page then says so plainly). */
  ours: string | null
  oursStatus: 'BUILT' | 'PARTIAL' | 'PLANNED' | 'MISSING'
}

export interface AlternativePage {
  slug: string
  name: string
  host: string | null
  segment: string | null
  rows: AlternativeRow[]
  /** Where their own pages show a feature we do not have today. Derived, so it stays honest as the catalog changes. */
  theyShowAndWeLack: AlternativeRow[]
  /** Our built capabilities in the areas they work in that no cited cell covers. */
  oursAlso: { key: string; name: string; description: string }[]
  checkedThrough: Date
  citedCount: number
  indexable: boolean
  forOrganizations: boolean
  title: string
  description: string
}

const ORG_AREAS = new Set(['outplacement', 'workforce_system', 'higher_ed', 'employer_hiring', 'retention', 'recruiters'])

/** "LHH (lhh.com)" -> "lhh"; "Randstad RiseSmart" -> "randstad-risesmart". */
export function slugFor(name: string): string {
  return displayName(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Display name without a trailing "(host)" or legal suffix noise. */
export function displayName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/,?\s+(Inc\.?|LLC|Ltd\.?|Corporation)$/i, '').replace(/\s+/g, ' ').trim()
}

export function hostFromUrl(url: string | null): string | null {
  if (!url) return null
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return null }
}

const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86_400_000

const CAP_BY_KEY = new Map<string, Capability>(CAPABILITIES.map((c) => [c.key, c]))

/** A cell is citable when it has an https evidence URL and a valid check date. */
export function isCitable(c: { evidenceUrl: string | null; checkedAt: Date | null; status: string }): boolean {
  if (c.status !== 'YES' && c.status !== 'PARTIAL' && c.status !== 'NO') return false
  if (!c.checkedAt || Number.isNaN(c.checkedAt.getTime())) return false
  try { return new URL(c.evidenceUrl ?? '').protocol === 'https:' } catch { return false }
}

export function buildAlternativePage(
  competitor: AlternativeCompetitor,
  cells: CitedCell[],
  now: Date = new Date(),
  catalog: Map<string, Capability> = CAP_BY_KEY,
): AlternativePage | null {
  const name = displayName(competitor.name)
  const slug = slugFor(competitor.name)
  if (!slug) return null

  const rows: AlternativeRow[] = []
  for (const cell of cells) {
    const cap = catalog.get(cell.capabilityKey)
    if (!cap) continue // a cell for a capability we no longer list says nothing about us; leave it off
    const built = cap.ours === 'BUILT' || cap.ours === 'PARTIAL'
    rows.push({
      capabilityKey: cap.key,
      name: cap.name,
      areaLabel: areaLabel(cap.area),
      theirs: cell.status,
      theirNote: cell.note?.trim() || null,
      evidenceUrl: cell.evidenceUrl,
      checkedAt: cell.checkedAt,
      ours: built ? cap.description : null,
      oursStatus: cap.ours,
    })
  }
  rows.sort((a, b) => a.areaLabel.localeCompare(b.areaLabel) || a.name.localeCompare(b.name))
  if (!rows.length) return null

  const checkedThrough = rows.reduce((m, r) => (r.checkedAt > m ? r.checkedAt : m), rows[0].checkedAt)
  const coveredKeys = new Set(rows.map((r) => r.capabilityKey))
  const oursAlso = CAPABILITIES
    .filter((c) => c.ours === 'BUILT' && competitor.areas.includes(c.area) && !coveredKeys.has(c.key))
    .slice(0, MAX_OURS_EXTRA)
    .map((c) => ({ key: c.key, name: c.name, description: c.description }))
  const theyShowAndWeLack = rows.filter((r) => (r.theirs === 'YES' || r.theirs === 'PARTIAL') && r.oursStatus !== 'BUILT')
  const indexable = rows.length >= MIN_CITED_CELLS && daysBetween(now, checkedThrough) <= MAX_CHECK_AGE_DAYS
  const forOrganizations = competitor.areas.some((a) => ORG_AREAS.has(a)) && !competitor.areas.some((a) => a === 'job_search' || a === 'resume')

  return {
    slug, name, host: hostFromUrl(competitor.url), segment: competitor.segment,
    rows, theyShowAndWeLack, oursAlso, checkedThrough, citedCount: rows.length, indexable, forOrganizations,
    title: `${name} alternative: NextChapter vs. ${name}`,
    description: `${name} compared with NextChapter across ${rows.length} capabilities, each ${name} entry linked to the page it was read from and dated. Plus what ${name} shows that we do not have today.`,
  }
}

export const ANSWER_LABEL: Record<CellAnswer, string> = { YES: 'Shown on their site', PARTIAL: 'Partly shown', NO: 'Not shown' }

export function formatCheckDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
