/**
 * Pure parsers for the public files behind the career taxonomy: the O*NET
 * database (tab-separated "text" release) and BLS OEWS / Employment
 * Projections exports saved as CSV. No I/O here; scripts/careers/* reads the
 * files and writes the rows, so the parsing is testable on small fixtures.
 */

export function parseDelimited(text: string, delimiter: '\t' | ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && delimiter === ',') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

export function toRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

export const parseTsv = (text: string) => toRecords(parseDelimited(text, '\t'))

// ── O*NET ────────────────────────────────────────────────────────────────────

export interface OnetOccupation {
  socCode: string
  title: string
  description: string
}
export type RatedKind = 'SKILL' | 'KNOWLEDGE' | 'ABILITY' | 'ACTIVITY'

export interface OnetElementRow {
  socCode: string
  skillId: string
  name: string
  kind: RatedKind | 'TECHNOLOGY'
  importance: number
  level: number | null
  hotTech: boolean
}

export function parseOnetOccupations(text: string): OnetOccupation[] {
  return parseTsv(text)
    .map((r) => ({ socCode: r['O*NET-SOC Code'], title: r['Title'], description: r['Description'] ?? '' }))
    .filter((o) => /^\d\d-\d{4}\.\d\d$/.test(o.socCode) && o.title)
}

export function parseJobZones(text: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of parseTsv(text)) {
    const zone = Number(r['Job Zone'])
    if (r['O*NET-SOC Code'] && zone >= 1 && zone <= 5) out.set(r['O*NET-SOC Code'], zone)
  }
  return out
}

/**
 * Skills.txt, Knowledge.txt, Abilities.txt and Work Activities.txt hold one row per occupation,
 * element and scale:
 * IM (importance, 1-5) and LV (level, 0-7). Both are rescaled to 0-100. Rows
 * O*NET flags as unreliable (Recommend Suppress = Y) are dropped, and a
 * "Not Relevant" level counts as zero level.
 */
const RATED_PREFIX: Record<RatedKind, string> = { SKILL: 'skill', KNOWLEDGE: 'knowledge', ABILITY: 'ability', ACTIVITY: 'activity' }

export function parseOnetRated(text: string, kind: RatedKind): OnetElementRow[] {
  const prefix = RATED_PREFIX[kind]
  const byKey = new Map<string, { socCode: string; skillId: string; name: string; importance?: number; level?: number }>()
  for (const r of parseTsv(text)) {
    if ((r['Recommend Suppress'] ?? '').toUpperCase() === 'Y') continue
    const soc = r['O*NET-SOC Code']
    const element = r['Element ID']
    const value = Number(r['Data Value'])
    if (!soc || !element || !Number.isFinite(value)) continue
    const key = `${soc}|${element}`
    const row = byKey.get(key) ?? { socCode: soc, skillId: `${prefix}:${element}`, name: r['Element Name'] }
    if (r['Scale ID'] === 'IM') row.importance = Math.max(0, Math.min(100, ((value - 1) / 4) * 100))
    else if (r['Scale ID'] === 'LV') row.level = (r['Not Relevant'] ?? '').toUpperCase() === 'Y' ? 0 : Math.max(0, Math.min(100, (value / 7) * 100))
    byKey.set(key, row)
  }
  return [...byKey.values()]
    .filter((r) => r.importance !== undefined && r.level !== undefined)
    .map((r) => ({
      socCode: r.socCode,
      skillId: r.skillId,
      name: r.name,
      kind,
      importance: Math.round(r.importance! * 10) / 10,
      level: Math.round(r.level! * 10) / 10,
      hotTech: false,
    }))
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Technology Skills.txt lists example tools per occupation. A tool O*NET marks
 * as Hot Technology or In Demand is scored 80, any other 50, so the gap lists
 * lead with what employers are asking for.
 */
export function parseOnetTechnology(text: string): OnetElementRow[] {
  const byKey = new Map<string, OnetElementRow>()
  for (const r of parseTsv(text)) {
    const soc = r['O*NET-SOC Code']
    const name = r['Example']
    if (!soc || !name) continue
    const slug = slugify(name)
    if (!slug) continue
    const hot = (r['Hot Technology'] ?? '').toUpperCase() === 'Y' || (r['In Demand'] ?? '').toUpperCase() === 'Y'
    const key = `${soc}|${slug}`
    const prior = byKey.get(key)
    if (prior) {
      prior.hotTech = prior.hotTech || hot
      prior.importance = prior.hotTech ? 80 : 50
      continue
    }
    byKey.set(key, { socCode: soc, skillId: `tech:${slug}`, name, kind: 'TECHNOLOGY', importance: hot ? 80 : 50, level: null, hotTech: hot })
  }
  return [...byKey.values()]
}

export function parseOnetAltTitles(text: string): { socCode: string; title: string }[] {
  return parseTsv(text)
    .map((r) => ({ socCode: r['O*NET-SOC Code'], title: r['Alternate Title'] }))
    .filter((r) => r.socCode && r.title)
}

export function parseOnetRelated(text: string): { socCode: string; relatedSocCode: string; tier: string; rank: number }[] {
  return parseTsv(text)
    .map((r) => ({
      socCode: r['O*NET-SOC Code'],
      relatedSocCode: r['Related O*NET-SOC Code'],
      tier: r['Relatedness Tier'],
      rank: Number(r['Index']),
    }))
    .filter((r) => r.socCode && r.relatedSocCode && r.socCode !== r.relatedSocCode && Number.isFinite(r.rank))
}

// ── BLS ──────────────────────────────────────────────────────────────────────

/** BLS marks suppressed cells with *, **, #, ~ and similar; none is a number. */
function blsNumber(v: string | undefined): number | null {
  if (v === undefined) return null
  const cleaned = v.replace(/[$,%\s]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

export interface OewsRow {
  soc6: string // "13-2011"
  medianWage: number | null
  employment: number | null
}

/**
 * OEWS national estimates (the national_M20XX_dl file saved as CSV). Wages of
 * $239,200 and over are published as "#"; we store those as unknown rather
 * than invent a number, and the Pivot Tool treats unknown pay as unknown.
 */
export function parseOews(text: string): OewsRow[] {
  const out: OewsRow[] = []
  for (const r of toRecords(parseDelimited(text, ','))) {
    const soc6 = r['OCC_CODE']
    if (!soc6 || !/^\d\d-\d{4}$/.test(soc6)) continue
    if (r['O_GROUP'] && r['O_GROUP'].toLowerCase() !== 'detailed') continue
    out.push({ soc6, medianWage: blsNumber(r['A_MEDIAN']), employment: blsNumber(r['TOT_EMP']) })
  }
  return out
}

export interface ProjectionRow {
  soc6: string
  growthPct: number | null
  annualOpenings: number | null
  typicalEducation: string | null
  period: string | null
}

/**
 * Employment Projections table 1.2 (occupational projections) saved as CSV.
 * BLS inserts title rows above the header and renames columns each cycle, so
 * the header row and columns are found by what they say, not by position.
 * Annual openings are published in thousands.
 */
export function parseProjections(text: string): ProjectionRow[] {
  const rows = parseDelimited(text, ',')
  const headerAt = rows.findIndex((r) => r.some((c) => /occupation(al)? code|matrix code/i.test(c)))
  if (headerAt < 0) return []
  const header = rows[headerAt].map((h) => h.trim())
  const col = (re: RegExp) => header.findIndex((h) => re.test(h))
  const codeCol = col(/code/i)
  const pctCol = header.findIndex((h) => /percent/i.test(h) && /change/i.test(h) && /employment/i.test(h))
  const openingsCol = col(/openings/i)
  const eduCol = col(/typical (entry-level )?education/i)
  if (codeCol < 0) return []
  const period = (header[pctCol] ?? '').match(/(\d{4})\D+(\d{2,4})\s*$/)
  const periodText = period ? `${period[1]}-${period[2].slice(-2)}` : null

  const out: ProjectionRow[] = []
  for (const r of rows.slice(headerAt + 1)) {
    const soc6 = (r[codeCol] ?? '').trim()
    // Summary rows ("00-0000" all occupations, "11-0000" a whole major group) aren't occupations.
    if (!/^\d\d-\d{4}$/.test(soc6) || soc6.endsWith('-0000')) continue
    const openings = blsNumber(r[openingsCol])
    out.push({
      soc6,
      growthPct: pctCol >= 0 ? blsNumber(r[pctCol]) : null,
      annualOpenings: openings === null ? null : Math.round(openings * 1000),
      typicalEducation: eduCol >= 0 ? (r[eduCol] ?? '').trim() || null : null,
      period: periodText,
    })
  }
  return out
}

// ── State funded-training lists (WIOA Eligible Training Provider Lists) ──────

export interface TrainingProgramRow {
  providerName: string
  programName: string
  url: string | null
  socCodes: string[]
  credential: string | null
  deliveryMode: 'IN_PERSON' | 'ONLINE' | 'HYBRID' | null
  costUsd: number | null
  durationWeeks: number | null
}

function pick(record: Record<string, string>, ...names: string[]): string {
  const lower = new Map(Object.entries(record).map(([k, v]) => [k.toLowerCase().trim(), v]))
  for (const n of names) {
    const v = lower.get(n)
    if (v) return v.trim()
  }
  return ''
}

/** "13-2011.00", "132011" or "13-2011" -> "13-2011"; anything else -> null. */
export function normalizeSoc6(raw: string): string | null {
  const m = raw.trim().match(/^(\d\d)-?(\d{4})(\.\d\d)?$/)
  return m ? `${m[1]}-${m[2]}` : null
}

function deliveryMode(raw: string): TrainingProgramRow['deliveryMode'] {
  const t = raw.toLowerCase()
  if (!t) return null
  if (/hybrid|blended/.test(t)) return 'HYBRID'
  if (/online|distance|virtual|remote/.test(t)) return 'ONLINE'
  if (/person|campus|classroom|on-?site/.test(t)) return 'IN_PERSON'
  return null
}

/**
 * Reads one state's approved-training list saved as CSV. States publish these in
 * their own layouts, so columns are found by common names; the file may need its
 * headers renamed to match. Provider and program are required; everything else is
 * optional and left empty rather than guessed. Rows are deduped on provider and program.
 */
export function parseTrainingPrograms(text: string): TrainingProgramRow[] {
  const seen = new Set<string>()
  const out: TrainingProgramRow[] = []
  for (const r of toRecords(parseDelimited(text, ','))) {
    const providerName = pick(r, 'provider', 'provider name', 'institution', 'school', 'training provider')
    const programName = pick(r, 'program', 'program name', 'training program', 'course', 'course name', 'training')
    if (!providerName || !programName) continue
    const key = `${providerName.toLowerCase()}|${programName.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    const socCodes = pick(r, 'soc', 'soc code', 'soc codes', 'occupation code', 'occupation codes')
      .split(/[;,|\s]+/)
      .map(normalizeSoc6)
      .filter((c): c is string => c !== null)
    const cost = blsNumber(pick(r, 'cost', 'total cost', 'tuition', 'program cost'))
    const weeks = blsNumber(pick(r, 'weeks', 'duration weeks', 'length weeks', 'duration (weeks)', 'program length (weeks)'))
    const url = pick(r, 'url', 'website', 'link', 'program url')
    out.push({
      providerName,
      programName,
      url: /^https?:\/\//i.test(url) ? url : null,
      socCodes: [...new Set(socCodes)],
      credential: pick(r, 'credential', 'certificate', 'award', 'credential awarded') || null,
      deliveryMode: deliveryMode(pick(r, 'mode', 'delivery', 'delivery mode', 'format')),
      costUsd: cost === null ? null : Math.round(cost),
      durationWeeks: weeks === null ? null : Math.round(weeks),
    })
  }
  return out
}

// ── BLS OEWS by area (nation, state, metro) ──────────────────────────────────

export type WageAreaType = 'NATIONAL' | 'STATE' | 'METRO'

export interface OewsAreaRow {
  soc6: string
  areaType: WageAreaType
  /** "US", the 2-digit state FIPS, or the 5-digit metro (CBSA) code. */
  areaCode: string
  areaName: string
  employment: number | null
  wageP10: number | null
  wageP25: number | null
  wageMedian: number | null
  wageP75: number | null
  wageP90: number | null
  /** At least one annual wage was withheld ("#") for being at or above BLS's wage ceiling. */
  ceilingHit: boolean
}

// OEWS AREA_TYPE codes. Territories and non-metropolitan areas are left out on purpose: they
// are not places we resolve a person to.
const AREA_TYPE_BY_CODE: Record<string, WageAreaType | null> = { '1': 'NATIONAL', '2': 'STATE', '4': 'METRO' }

type WageCell = { value: number | null; ceiling: boolean }
function wageCell(raw: string | undefined): WageCell {
  const v = (raw ?? '').trim()
  if (v === '#') return { value: null, ceiling: true }
  return { value: blsNumber(v), ceiling: false }
}

/**
 * OEWS national, state or metro file saved as CSV. Annual wage columns are used (A_PCT10 ..
 * A_PCT90). `expected` is the file kind the caller thinks it is loading; rows of any other area
 * type in the file are skipped, which also protects against loading a metro file as a state file.
 * Only detailed occupations are kept. Wages BLS withholds at its ceiling become null with
 * ceilingHit set, never a made-up number.
 */
export function parseOewsAreas(text: string, expected: WageAreaType): OewsAreaRow[] {
  const out: OewsAreaRow[] = []
  for (const r of toRecords(parseDelimited(text, ','))) {
    const soc6 = r['OCC_CODE']
    if (!soc6 || !/^\d\d-\d{4}$/.test(soc6) || soc6.endsWith('-0000')) continue
    if (r['O_GROUP'] && r['O_GROUP'].toLowerCase() !== 'detailed') continue

    const typeCode = (r['AREA_TYPE'] ?? '').trim()
    const areaType = typeCode ? (AREA_TYPE_BY_CODE[typeCode] ?? null) : expected
    if (areaType !== expected) continue

    const rawArea = (r['AREA'] ?? '').trim()
    const areaCode = areaType === 'NATIONAL' ? 'US' : areaType === 'STATE' ? rawArea.padStart(2, '0') : rawArea.padStart(5, '0')
    if (areaType !== 'NATIONAL' && !/^\d+$/.test(rawArea)) continue

    const p10 = wageCell(r['A_PCT10'])
    const p25 = wageCell(r['A_PCT25'])
    const median = wageCell(r['A_MEDIAN'])
    const p75 = wageCell(r['A_PCT75'])
    const p90 = wageCell(r['A_PCT90'])
    const employment = blsNumber(r['TOT_EMP'])
    out.push({
      soc6,
      areaType,
      areaCode,
      areaName: (r['AREA_TITLE'] ?? '').trim() || (areaType === 'NATIONAL' ? 'United States' : areaCode),
      employment: employment === null ? null : Math.round(employment),
      wageP10: p10.value,
      wageP25: p25.value,
      wageMedian: median.value,
      wageP75: p75.value,
      wageP90: p90.value,
      ceilingHit: [p10, p25, median, p75, p90].some((c) => c.ceiling),
    })
  }
  return out
}


// ── O*NET tasks ──────────────────────────────────────────────────────────────

export interface OnetTaskRow {
  socCode: string
  taskId: number
  text: string
  taskType: 'CORE' | 'SUPPLEMENTAL'
}

/**
 * Task Statements.txt: what the job does day to day. Core tasks first, then supplemental, each in
 * O*NET's own order, capped per occupation so the table stays small and the page stays readable.
 */
export function parseOnetTasks(text: string, perOccupation = 12): OnetTaskRow[] {
  const byOcc = new Map<string, OnetTaskRow[]>()
  for (const r of parseTsv(text)) {
    const socCode = r['O*NET-SOC Code']
    const taskId = Number(r['Task ID'])
    const task = r['Task']
    if (!socCode || !Number.isInteger(taskId) || !task) continue
    const taskType = (r['Task Type'] ?? '').toLowerCase().startsWith('core') ? 'CORE' : 'SUPPLEMENTAL'
    byOcc.set(socCode, [...(byOcc.get(socCode) ?? []), { socCode, taskId, text: task, taskType }])
  }
  const out: OnetTaskRow[] = []
  for (const rows of byOcc.values()) {
    const ordered = [...rows].sort((a, b) => Number(b.taskType === 'CORE') - Number(a.taskType === 'CORE') || a.taskId - b.taskId)
    out.push(...ordered.slice(0, perOccupation))
  }
  return out
}
