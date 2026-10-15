// A small delimited-text reader for the O*NET (tab-separated) and BLS (CSV) files. Pure.
// Columns are looked up by name, never position, because both agencies reorder and
// rename columns between releases; a missing column stops the import with the headers
// found instead of loading shifted data.

export interface ParsedTable {
  header: string[]
  rows: string[][]
}

/** Splits text into records, honouring quoted fields (embedded delimiters, quotes, newlines). */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delimiter) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((v) => v.trim() !== '')) records.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v.trim() !== '')) records.push(row)
  return records
}

/**
 * Parses a table. `headerStartsWith` skips the title rows some BLS sheets carry above
 * the header: the header is the first record with a cell matching it.
 */
export function parseTable(text: string, opts: { delimiter?: '\t' | ','; headerStartsWith?: RegExp } = {}): ParsedTable {
  const delimiter = opts.delimiter ?? (text.slice(0, text.search(/\n|$/)).includes('\t') ? '\t' : ',')
  const records = splitRecords(text, delimiter)
  const at = opts.headerStartsWith ? records.findIndex((r) => r.some((c) => opts.headerStartsWith!.test(c.trim()))) : 0
  if (at < 0) throw new Error(`No header row matching ${opts.headerStartsWith} was found`)
  return { header: records[at].map((h) => h.trim()), rows: records.slice(at + 1) }
}

export interface ColumnSpec {
  /** Header names (case-insensitive, trimmed) or patterns, first match wins. */
  match: (string | RegExp)[]
  optional?: boolean
}

/** Resolves each wanted column to its index. Throws, listing the headers found, if a required one is missing. */
export function resolveColumns<K extends string>(table: ParsedTable, spec: Record<K, ColumnSpec>, label: string): Record<K, number> {
  const out = {} as Record<K, number>
  const missing: string[] = []
  for (const key of Object.keys(spec) as K[]) {
    const idx = table.header.findIndex((h) => spec[key].match.some((m) => (typeof m === 'string' ? h.toLowerCase() === m.toLowerCase() : m.test(h))))
    if (idx < 0 && !spec[key].optional) missing.push(key)
    out[key] = idx
  }
  if (missing.length > 0) throw new Error(`${label}: no column found for ${missing.join(', ')}. Headers present: ${table.header.join(' | ')}`)
  return out
}

export const cell = (row: string[], idx: number): string => (idx >= 0 ? (row[idx] ?? '').trim() : '')

/** A plain number, or null for blanks and the agencies' suppression markers. */
export function numberOrNull(v: string): number | null {
  const t = v.replace(/[,$]/g, '').trim()
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}
