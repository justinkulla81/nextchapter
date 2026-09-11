import { inflateRawSync } from 'node:zlib'

/**
 * A minimal .xlsx reader.
 *
 * An xlsx is a ZIP of XML, and the two parts needed here — the shared-string
 * table and a worksheet's cell grid — are simple enough to read directly.
 * Written rather than pulled in because this parses ONE government file on a
 * schedule: a spreadsheet library would be a standing dependency, with its own
 * CVE surface, for a job this small. If a second format ever needs reading,
 * that trade flips.
 *
 * Handles what CA's WARN report actually contains: shared strings, inline
 * strings, numbers and ISO dates. Not formulas, styles or number formats.
 */

function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65_558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a zip archive — the download may be an error page.')

  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const out = new Map<string, Buffer>()

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)

    // The local header repeats the name and extra fields at different lengths,
    // so data position must come from there rather than the central directory.
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const start = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(start, start + compSize)

    out.set(name, method === 0 ? raw : inflateRawSync(raw))
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

/** Column letters to a zero-based index: A=0, Z=25, AA=26. */
export function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export interface XlsxSheet {
  name: string
  rows: string[][]
}

export function readXlsx(buf: Buffer): XlsxSheet[] {
  const files = readZip(buf)

  const sharedXml = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? ''
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decodeEntities([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
  )

  const workbook = files.get('xl/workbook.xml')?.toString('utf8') ?? ''
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? ''
  const relTarget = new Map(
    [...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]])
  )

  const sheets: XlsxSheet[] = []
  for (const m of workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = relTarget.get(m[2])
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const xml = files.get(path)?.toString('utf8')
    if (!xml) continue

    const rows: string[][] = []
    for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = []
      for (const c of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g)) {
        const attrs = c[1] ?? c[3] ?? ''
        const body = c[2] ?? ''
        const refMatch = attrs.match(/r="([A-Z]+\d+)"/)
        const idx = refMatch ? columnIndex(refMatch[1]) : cells.length
        const type = attrs.match(/t="([^"]+)"/)?.[1]

        let value = ''
        if (type === 's') {
          const i = Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1)
          value = shared[i] ?? ''
        } else if (type === 'inlineStr') {
          value = decodeEntities([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
        } else {
          value = decodeEntities(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
        }
        while (cells.length < idx) cells.push('')
        cells[idx] = value
      }
      rows.push(cells)
    }
    sheets.push({ name: decodeEntities(m[1]), rows })
  }
  return sheets
}

/**
 * Excel serial date to a real Date.
 *
 * Dates arrive as a day count, not text: CA's WARN report gives 46203 where a
 * reader expects 2026-06-30. The 25569 offset is the days between Excel's
 * epoch and Unix's, and it already absorbs Excel's famous 1900-leap-year bug,
 * which is why it is 25569 rather than 25567.
 */
export function excelSerialToDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) {
    // Some states publish real ISO text instead; accept that too.
    const parsed = new Date(String(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  // Below this the value is a duration or a mistake, not a date.
  if (n < 20_000 || n > 80_000) return null
  return new Date(Math.round((n - 25_569) * 86_400_000))
}
