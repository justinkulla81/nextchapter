/**
 * CSV parsing + value normalisation shared by the CRM source importers.
 *
 * A quote-aware parser is genuinely required here, not defensive coding: the
 * exported Networking CRM contains newlines inside quoted note fields, so a
 * naive line-splitter silently merges two contacts into one corrupted row
 * (3,552 physical lines vs 3,551 real records). src/lib/network/csv-import.ts
 * splits per-line and so can't be reused for these files.
 */

/** Full RFC-4180 parse: handles quoted commas, quoted newlines, "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Parsed rows keyed by header name, with the original row number kept for provenance. */
export interface SourceRow {
  get(col: string): string | null
  rowNumber: number
  raw: Record<string, string>
}

export function toRows(text: string, headerRowIndex = 0): SourceRow[] {
  const grid = parseCsv(text)
  if (grid.length <= headerRowIndex) return []
  const headers = grid[headerRowIndex].map((h) => h.trim())
  return grid.slice(headerRowIndex + 1).map((cells, i) => {
    const raw: Record<string, string> = {}
    headers.forEach((h, j) => { if (h) raw[h] = (cells[j] ?? '').trim() })
    return {
      rowNumber: headerRowIndex + 2 + i,
      raw,
      get(col: string) {
        const v = raw[col]
        if (v === undefined) return null
        const t = v.trim()
        if (!t || t === '—' || t === '-' || t === 'n/a' || t === 'N/A') return null
        return t
      },
    }
  })
}

/** Bare LinkedIn slug — the strongest dedup key we have. */
export function linkedinSlug(url: string | null | undefined): string | null {
  if (!url) return null
  const m = String(url).toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}

export function cleanEmail(v: string | null | undefined): string | null {
  if (!v) return null
  const e = String(v).trim().toLowerCase()
  return e.includes('@') && !e.includes(' ') ? e : null
}

/** Placeholders that look like an organisation but aren't one. */
const ORG_NOISE = new Set([
  'none', 'not named', 'not listed (public)', 'independent', 'self-employed',
  'self employed', 'various', 'stealth startup', 'multiple organizations', 'n/a', 'unknown',
])
export function isRealOrgName(v: string | null | undefined): boolean {
  if (!v) return false
  return !ORG_NOISE.has(String(v).trim().toLowerCase())
}

/** Strips credential suffixes and parentheticals so name keys match across sources. */
export function cleanPersonName(v: string | null | undefined): string | null {
  if (!v) return null
  let s = String(v).replace(/\(.*?\)/g, ' ')
  s = s.replace(
    /,\s*(CFA|CAIA|PhD|Ph\.D\.?|MBA|MD|JD|CPA|FACS|SHRM-SCP|MSc|MS|MA|RN|PMP|ChFC|CEPA|AAMS|CLU|CLTC|RICP|ACC|FCA|FAAD|FACMS|FASMS|LION)\b.*$/i,
    '',
  )
  s = s.replace(/\s+/g, ' ').trim()
  // Drop leading emoji/symbol decoration seen in a few exported names.
  s = s.replace(/^[^\p{L}]+/u, '').trim()
  return s || null
}

/** "$250K–$1M" / "Up to ~$1M" / "$25K-$250K" → cents-free USD bounds. */
export function parseCheckSize(v: string | null | undefined): { min: number | null; max: number | null } {
  if (!v) return { min: null, max: null }
  const nums: number[] = []
  const re = /\$\s*([\d.]+)\s*([KkMm])?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(String(v))) !== null) {
    const n = parseFloat(m[1])
    if (Number.isNaN(n)) continue
    const mult = m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2]?.toLowerCase() === 'k' ? 1_000 : 1
    nums.push(Math.round(n * mult))
  }
  if (nums.length === 0) return { min: null, max: null }
  if (nums.length === 1) {
    // "Up to ~$1M" is a ceiling, not a floor.
    return /up to|max|≤|under/i.test(String(v)) ? { min: null, max: nums[0] } : { min: nums[0], max: nums[0] }
  }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

/** Pulls a real date out of a cell, or returns null when the cell is prose. */
export function parseDateish(v: string | null | undefined): Date | null {
  if (!v) return null
  const s = String(v).trim()
  const iso = s.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const named = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i)
  if (named) {
    const d = new Date(`${named[1]} ${named[2]}, ${named[3]} 00:00:00 UTC`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}
