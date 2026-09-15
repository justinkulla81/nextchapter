/**
 * Minimal HTML table reader for state WARN pages.
 *
 * Most states publish WARN as a plain server-rendered table. A regex reader is
 * enough for that and keeps the dependency list empty, which matters because
 * this runs on a weekly cron where a broken install is invisible until Monday.
 * Anything that needs a real DOM (a JavaScript grid, a Tableau embed) is not
 * supported on purpose — see WARN_SOURCES for which states those are.
 */

/** Strips tags and decodes the entities that actually show up in these pages. */
export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Returns every table on the page as rows of cells, header row included. */
export function readTables(html: string): string[][][] {
  const tables: string[][][] = []
  for (const m of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows: string[][] = []
    for (const tr of m[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1]))
      if (cells.length) rows.push(cells)
    }
    if (rows.length) tables.push(rows)
  }
  return tables
}

/**
 * Returns the rows of the largest table on the page.
 *
 * Kept for sources that publish exactly one table. States that split their
 * notices across a table per year (Utah files eighteen of them) must use
 * readTables instead, or they silently sync whichever year happens to be
 * longest — which is how Utah briefly reported 2020 as its newest notice.
 */
export function readTable(html: string): string[][] {
  const tables = readTables(html)
  if (!tables.length) return []
  return tables.reduce((a, b) => (b.length > a.length ? b : a))
}

/**
 * Finds a column by header text so a state reordering its columns does not
 * silently shift every value one to the left.
 */
export function columnOf(header: string[], ...names: string[]): number {
  const norm = header.map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))
  for (const name of names) {
    const want = name.toLowerCase().replace(/[^a-z]/g, '')
    const exact = norm.indexOf(want)
    if (exact !== -1) return exact
    const partial = norm.findIndex((h) => h.includes(want))
    if (partial !== -1) return partial
  }
  return -1
}

/** Parses the date formats these pages use; returns null rather than a guess. */
export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const s = String(raw).trim().replace(/\s+\d{1,2}:\d{2}:\d{2}.*$/, '')
  if (!s) return null

  const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (mdy) {
    const year = mdy[3].length === 2 ? 2000 + parseInt(mdy[3], 10) : parseInt(mdy[3], 10)
    const d = new Date(Date.UTC(year, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10)))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const named = new Date(s)
  if (!Number.isNaN(named.getTime()) && named.getUTCFullYear() > 1990 && named.getUTCFullYear() < 2100) {
    return named
  }
  return null
}

/**
 * Pulls a headcount out of a cell.
 *
 * States write these as "39 (Remote service workers)" and "2 (South Dakota)",
 * so a parenthetical is stripped before reading the number — otherwise the
 * note's digits get absorbed into the count.
 */
export function parseCount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const withoutParens = String(raw).replace(/\([^)]*\)/g, ' ')
  const m = withoutParens.match(/(\d[\d,]*)/)
  if (!m) return null
  const n = parseInt(m[1].replace(/,/g, ''), 10)
  if (!Number.isFinite(n) || n <= 0 || n > 500_000) return null
  return n
}
