import { normalizeOrgName } from '@/lib/text/org-name-match'
import { parseCount, parseDate, stripTags } from './html'
import type { WarnRow } from './sources'

/**
 * Washington's Employment Security Department lists notices in an ASP.NET grid, one page at a time, newest received first:
 * company, location, layoff start date, number of workers, closure or layoff, type, received date. A page is a form post with
 * the grid's own view state, so the pages are walked in order. The daily Big Local News scraper stored the layoff start date in
 * place of the received date for 235 of 273 notices; this reads both.
 */
export const WASHINGTON_PAGE = 'https://fortress.wa.gov/esd/file/warn/Public/SearchWARN.aspx'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:68.0) Gecko/20100101 Firefox/68.0'

/** The data rows of the grid on one page: each has company, location, layoff start, workers, closure/layoff, type, received date. */
export function parseWashingtonGrid(html: string): WarnRow[] {
  const start = html.indexOf('id="ucPSW_gvMain"')
  if (start === -1) return []
  const out: WarnRow[] = []
  for (const tr of html.slice(start).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]).replace(/\s+/g, ' ').trim())
    // The pager row has one cell of page numbers; the header row has th cells, not td.
    if (cells.length < 7) continue
    const [company, location, layoffStart, workers, kind, type, received] = cells
    const noticeDate = parseDate(received)
    if (!company || company.length < 2 || !noticeDate) continue
    out.push({
      state: 'WA',
      employer: company,
      normalizedEmployer: normalizeOrgName(company),
      noticeDate,
      effectiveDate: parseDate(layoffStart),
      employees: parseCount(workers),
      layoffType: [kind, type].filter(Boolean).join(' - ') || null,
      county: null,
      address: location || null,
      industry: null,
    })
  }
  return out
}

function hiddenFields(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)) out[m[1]] = m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  return out
}

/** Walks the grid page by page until a page is empty or entirely older than `oldest` (the list is newest first). */
export async function fetchWashington(oldest: Date, maxPages = 80): Promise<WarnRow[]> {
  const rows: WarnRow[] = []
  let cookie = ''
  let res = await fetch(WASHINGTON_PAGE, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`WA WARN returned ${res.status}`)
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  let html = await res.text()
  for (let page = 1; page <= maxPages; page++) {
    const here = parseWashingtonGrid(html)
    if (!here.length) break
    rows.push(...here)
    if (here.every((r) => r.noticeDate! < oldest)) break
    const form = { ...hiddenFields(html), __EVENTTARGET: 'ucPSW$gvMain', __EVENTARGUMENT: `Page$${page + 1}` }
    await new Promise((r) => setTimeout(r, 300))
    res = await fetch(WASHINGTON_PAGE, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`WA WARN page ${page + 1} returned ${res.status}`)
    html = await res.text()
  }
  return rows
}
