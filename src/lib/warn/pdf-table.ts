import { getDocumentProxy } from 'unpdf'

/**
 * Reads a table out of a PDF by where the text sits on the page.
 *
 * pdfText (./pdf.ts) returns words in stream order with no layout, which cannot say where a wrapped company name ends and the
 * next row begins. unpdf (already a dependency, see src/lib/resume/extract-text.ts) gives each piece of text with its position,
 * so a row is rebuilt by column: every piece is assigned to the nearest row that carries a date, and to a column by where it
 * starts, measured against the header's own positions so a state that moves a column still lines up.
 */
export interface PdfItem { s: string; x: number; y: number }

export async function pdfPages(buf: Buffer): Promise<PdfItem[][]> {
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const pages: PdfItem[][] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    pages.push(
      content.items
        .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && 'transform' in i && !!i.str.trim())
        .map((i) => ({ s: i.str.replace(/\s+/g, ' ').trim(), x: i.transform[4], y: i.transform[5] })),
    )
  }
  return pdf.numPages ? pages : []
}

export interface ColumnSpec { key: string; header: RegExp }

/** The left edge of each column's header, then a boundary halfway to the next: data is not always aligned the way its header is. */
export function columnEdges(items: PdfItem[], columns: ColumnSpec[]): { key: string; from: number; to: number }[] {
  const xs = columns.map((c) => {
    const hit = items.filter((i) => c.header.test(i.s)).sort((a, b) => b.y - a.y)[0]
    if (!hit) throw new Error(`the table header "${c.header.source}" is no longer there; the PDF's layout has changed`)
    return { key: c.key, x: hit.x }
  })
  xs.sort((a, b) => a.x - b.x)
  return xs.map((c, i) => ({
    key: c.key,
    from: i === 0 ? -Infinity : (xs[i - 1].x + c.x) / 2,
    to: i === xs.length - 1 ? Infinity : (c.x + xs[i + 1].x) / 2,
  }))
}

const DATE_CELL = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
/** How far (in PDF points; a line is about 12) a piece of text may sit from the row it belongs to. */
const MAX_WRAP = 45

/**
 * One record per row that has a date in `anchorKey`; every other piece of text joins the nearest such row by height, so a name
 * that wraps above and below the line carrying the dates stays with its own record.
 */
export function pdfTableRows(items: PdfItem[], columns: ColumnSpec[], anchorKey: string): Record<string, string>[] {
  const edges = columnEdges(items, columns)
  const keyOf = (x: number) => edges.find((e) => x >= e.from && x < e.to)?.key ?? null
  const anchors = items.filter((i) => keyOf(i.x) === anchorKey && DATE_CELL.test(i.s))
  if (!anchors.length) return []
  const ys = [...new Set(anchors.map((a) => Math.round(a.y)))].sort((a, b) => b - a)
  const topOfTable = Math.max(...ys)
  const byAnchor = new Map<number, PdfItem[]>(ys.map((y) => [y, []]))
  for (const it of items) {
    const key = keyOf(it.x)
    if (!key) continue
    // Header text and anything above the first row is not data.
    if (it.y > topOfTable + 12) continue
    let best = ys[0]
    for (const y of ys) if (Math.abs(it.y - y) < Math.abs(it.y - best) || (Math.abs(it.y - y) === Math.abs(it.y - best) && y > best)) best = y
    // A wrapped cell is a few lines tall; a footer or page number is far from every row.
    if (Math.abs(it.y - best) > MAX_WRAP) continue
    byAnchor.get(best)!.push(it)
  }
  return ys.map((y) => {
    const row: Record<string, string> = {}
    for (const e of edges) {
      row[e.key] = byAnchor.get(y)!
        .filter((i) => keyOf(i.x) === e.key)
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((i) => i.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    return row
  })
}
