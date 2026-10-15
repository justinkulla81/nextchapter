import { cell, numberOrNull, parseTable, resolveColumns } from './delimited'
import { isTargetOccupation, toSocCode } from '../target-occupations'
import { normalizeTitle } from '../title-to-soc'
import type { ElementKind } from '../types'

// Parsers for the O*NET database text files (tab-separated; onetcenter.org/database.html).
// Each takes a file's text and returns plain rows for the importer to write.

const CODE = ['O*NET-SOC Code']

export interface OnetOccupationRow {
  onetSocCode: string
  socCode: string
  title: string
  description: string | null
}

export function parseOccupationData(text: string): OnetOccupationRow[] {
  const t = parseTable(text)
  const c = resolveColumns(t, { code: { match: CODE }, title: { match: ['Title'] }, description: { match: ['Description'], optional: true } }, 'Occupation Data')
  const out: OnetOccupationRow[] = []
  for (const r of t.rows) {
    const onetSocCode = cell(r, c.code)
    const socCode = toSocCode(onetSocCode)
    if (!socCode) continue
    out.push({ onetSocCode, socCode, title: cell(r, c.title), description: cell(r, c.description) || null })
  }
  return out
}

export function parseJobZones(text: string): Map<string, number> {
  const t = parseTable(text)
  const c = resolveColumns(t, { code: { match: CODE }, zone: { match: ['Job Zone'] } }, 'Job Zones')
  const out = new Map<string, number>()
  for (const r of t.rows) {
    const zone = numberOrNull(cell(r, c.zone))
    if (zone !== null) out.set(cell(r, c.code), zone)
  }
  return out
}

export interface OnetElementRow {
  onetSocCode: string
  kind: ElementKind
  elementId: string
  elementName: string
  importance: number
  level: number
}

/**
 * Skills, Knowledge, Abilities and Work Activities files share one shape: a row per
 * element and scale, with Importance (IM, 1-5) and Level (LV, 0-7). An element is kept
 * only with both scales, not flagged "Recommend Suppress" (too little data) and not
 * "Not Relevant" to the occupation.
 */
export function parseElements(text: string, kind: ElementKind): OnetElementRow[] {
  const t = parseTable(text)
  const c = resolveColumns(
    t,
    {
      code: { match: CODE },
      id: { match: ['Element ID'] },
      name: { match: ['Element Name'] },
      scale: { match: ['Scale ID'] },
      value: { match: ['Data Value'] },
      suppress: { match: ['Recommend Suppress'], optional: true },
      notRelevant: { match: ['Not Relevant'], optional: true },
    },
    `${kind} file`
  )
  const byElement = new Map<string, { row: Omit<OnetElementRow, 'importance' | 'level'>; im?: number; lv?: number; drop: boolean }>()
  for (const r of t.rows) {
    const scale = cell(r, c.scale)
    if (scale !== 'IM' && scale !== 'LV') continue
    const onetSocCode = cell(r, c.code)
    const elementId = cell(r, c.id)
    const key = `${onetSocCode}|${elementId}`
    const entry = byElement.get(key) ?? { row: { onetSocCode, kind, elementId, elementName: cell(r, c.name) }, drop: false }
    const value = numberOrNull(cell(r, c.value))
    if (value === null || cell(r, c.suppress) === 'Y' || cell(r, c.notRelevant) === 'Y') entry.drop = true
    if (scale === 'IM') entry.im = value ?? undefined
    else entry.lv = value ?? undefined
    byElement.set(key, entry)
  }
  const out: OnetElementRow[] = []
  for (const e of byElement.values()) {
    if (e.drop || e.im === undefined || e.lv === undefined) continue
    out.push({ ...e.row, importance: e.im, level: e.lv })
  }
  return out
}

export interface OnetTechSkillRow {
  onetSocCode: string
  example: string
  commodity: string | null
  hotTechnology: boolean
  inDemand: boolean
}

export function parseTechnologySkills(text: string): OnetTechSkillRow[] {
  const t = parseTable(text)
  const c = resolveColumns(
    t,
    {
      code: { match: CODE },
      example: { match: ['Example'] },
      commodity: { match: ['Commodity Title'], optional: true },
      hot: { match: ['Hot Technology'], optional: true },
      demand: { match: ['In Demand'], optional: true },
    },
    'Technology Skills'
  )
  const seen = new Map<string, OnetTechSkillRow>()
  for (const r of t.rows) {
    const onetSocCode = cell(r, c.code)
    const example = cell(r, c.example)
    if (!onetSocCode || !example) continue
    const key = `${onetSocCode}|${example.toLowerCase()}`
    const row = { onetSocCode, example, commodity: cell(r, c.commodity) || null, hotTechnology: cell(r, c.hot) === 'Y', inDemand: cell(r, c.demand) === 'Y' }
    const prev = seen.get(key)
    // The same product can be listed under several commodities; keep a hot or in-demand flag if any carries it.
    if (prev) { prev.hotTechnology ||= row.hotTechnology; prev.inDemand ||= row.inDemand } else seen.set(key, row)
  }
  return [...seen.values()]
}

export interface OnetAltTitleRow {
  onetSocCode: string
  title: string
  normalizedTitle: string
}

export function parseAlternateTitles(text: string): OnetAltTitleRow[] {
  const t = parseTable(text)
  const c = resolveColumns(t, { code: { match: CODE }, title: { match: ['Alternate Title'] } }, 'Alternate Titles')
  const seen = new Map<string, OnetAltTitleRow>()
  for (const r of t.rows) {
    const onetSocCode = cell(r, c.code)
    const title = cell(r, c.title)
    const normalizedTitle = normalizeTitle(title)
    if (!onetSocCode || !normalizedTitle) continue
    const key = `${onetSocCode}|${normalizedTitle}`
    if (!seen.has(key)) seen.set(key, { onetSocCode, title, normalizedTitle })
  }
  return [...seen.values()]
}

export interface OnetRelatedRow {
  onetSocCode: string
  relatedOnetSocCode: string
  tier: string | null
  relatedIndex: number | null
}

export function parseRelatedOccupations(text: string): OnetRelatedRow[] {
  const t = parseTable(text)
  const c = resolveColumns(
    t,
    {
      code: { match: CODE },
      related: { match: ['Related O*NET-SOC Code'] },
      tier: { match: ['Relatedness Tier'], optional: true },
      index: { match: ['Index'], optional: true },
    },
    'Related Occupations'
  )
  const seen = new Map<string, OnetRelatedRow>()
  for (const r of t.rows) {
    const onetSocCode = cell(r, c.code)
    const relatedOnetSocCode = cell(r, c.related)
    if (!onetSocCode || !relatedOnetSocCode || seen.has(`${onetSocCode}|${relatedOnetSocCode}`)) continue
    seen.set(`${onetSocCode}|${relatedOnetSocCode}`, { onetSocCode, relatedOnetSocCode, tier: cell(r, c.tier) || null, relatedIndex: numberOrNull(cell(r, c.index)) })
  }
  return [...seen.values()]
}

/** The O*NET files as read, one text per file name; a missing optional file is just absent. */
export interface OnetFiles {
  occupationData: string
  jobZones: string
  skills?: string
  knowledge?: string
  abilities?: string
  workActivities?: string
  technologySkills?: string
  alternateTitles?: string
  relatedOccupations?: string
}

export interface OnetImport {
  occupations: (OnetOccupationRow & { jobZone: number | null; isTarget: boolean })[]
  elements: OnetElementRow[]
  techSkills: OnetTechSkillRow[]
  altTitles: OnetAltTitleRow[]
  related: OnetRelatedRow[]
}

/**
 * Everything to write, with the child tables cut down to the in-scope occupations: the
 * rest are never read, and a quarter of a million unused rows is not worth storing.
 */
export function buildOnetImport(files: OnetFiles): OnetImport {
  const zones = parseJobZones(files.jobZones)
  const occupations = parseOccupationData(files.occupationData).map((o) => {
    const jobZone = zones.get(o.onetSocCode) ?? null
    return { ...o, jobZone, isTarget: isTargetOccupation(o.socCode, jobZone) }
  })
  const inScope = new Set(occupations.filter((o) => o.isTarget).map((o) => o.onetSocCode))
  const keep = <T extends { onetSocCode: string }>(rows: T[]) => rows.filter((r) => inScope.has(r.onetSocCode))
  return {
    occupations,
    elements: keep([
      ...(files.skills ? parseElements(files.skills, 'SKILL') : []),
      ...(files.knowledge ? parseElements(files.knowledge, 'KNOWLEDGE') : []),
      ...(files.abilities ? parseElements(files.abilities, 'ABILITY') : []),
      ...(files.workActivities ? parseElements(files.workActivities, 'ACTIVITY') : []),
    ]),
    techSkills: keep(files.technologySkills ? parseTechnologySkills(files.technologySkills) : []),
    altTitles: keep(files.alternateTitles ? parseAlternateTitles(files.alternateTitles) : []),
    // A related occupation only matters when it is in scope too.
    related: keep(files.relatedOccupations ? parseRelatedOccupations(files.relatedOccupations) : []).filter((r) => inScope.has(r.relatedOnetSocCode)),
  }
}
