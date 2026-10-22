// Anthropic Economic Index (AEI) observed exposure by occupation: parsing, bands
// and vintage comparison. Source file: labor_market_impacts/job_exposure.csv in
// huggingface.co/datasets/Anthropic/EconomicIndex (data CC BY).
//
// observed_exposure (0 to 1) is the share of an occupation's tasks Claude is
// observed doing in work usage, limited to tasks an LLM could plausibly speed up.
// It is usage-based and Claude-only. It is not a forecast and not job loss.

export interface ExposureRow {
  socCode: string
  title: string
  exposure: number
}

export type ExposureBand = 'none' | 'under-0.1' | '0.1-0.3' | '0.3-and-above'

export const EXPOSURE_BANDS: ExposureBand[] = ['none', 'under-0.1', '0.1-0.3', '0.3-and-above']

export const BAND_LABELS: Record<ExposureBand, string> = {
  none: 'No observed exposure (0)',
  'under-0.1': 'Under 0.10',
  '0.1-0.3': '0.10 to 0.29',
  '0.3-and-above': '0.30 and above',
}

export function bandFor(exposure: number): ExposureBand {
  if (exposure <= 0) return 'none'
  if (exposure < 0.1) return 'under-0.1'
  if (exposure < 0.3) return '0.1-0.3'
  return '0.3-and-above'
}

/** Splits one CSV line, honouring double-quoted fields with commas and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

/** Parses job_exposure.csv (occ_code,title,observed_exposure). Throws on a changed header. */
export function parseExposureCsv(csv: string): ExposureRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.trim())
  if (header[0] !== 'occ_code' || header[1] !== 'title' || header[2] !== 'observed_exposure') {
    throw new Error(`Unexpected AEI exposure header: ${header.join(',')}`)
  }
  const rows: ExposureRow[] = []
  for (const line of lines.slice(1)) {
    const [socCode, title, raw] = splitCsvLine(line)
    const exposure = Number(raw)
    if (!/^\d\d-\d{4}$/.test(socCode ?? '') || !title || !Number.isFinite(exposure) || exposure < 0 || exposure > 1) {
      throw new Error(`Bad AEI exposure row: ${line}`)
    }
    rows.push({ socCode, title, exposure })
  }
  return rows
}

export interface ExposureMover {
  socCode: string
  title: string
  previous: number
  current: number
  change: number
}

export interface VintageComparison {
  added: ExposureRow[]
  removed: ExposureRow[]
  movers: ExposureMover[]
}

/** Largest changes in observed exposure between two stored vintages (absolute change, top `limit`). */
export function compareVintages(previous: ExposureRow[], current: ExposureRow[], limit = 15): VintageComparison {
  const prev = new Map(previous.map((r) => [r.socCode, r]))
  const curr = new Map(current.map((r) => [r.socCode, r]))
  const added = current.filter((r) => !prev.has(r.socCode))
  const removed = previous.filter((r) => !curr.has(r.socCode))
  const movers: ExposureMover[] = []
  for (const r of current) {
    const p = prev.get(r.socCode)
    if (!p) continue
    const change = Math.round((r.exposure - p.exposure) * 10000) / 10000
    if (change !== 0) movers.push({ socCode: r.socCode, title: r.title, previous: p.exposure, current: r.exposure, change })
  }
  movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  return { added, removed, movers: movers.slice(0, limit) }
}
