import { readPercent, sameEmployer } from './news-headline'

/**
 * SEC 8-K Item 2.05 ("costs associated with exit or disposal activities"):
 * the filing a public company makes when it commits to a restructuring, most
 * often a layoff. It lands the day the company decides, before any WARN
 * notice and often before the press, so it is the earliest reliable signal
 * for a public employer. Item 2.05 also covers plant closures and write-offs,
 * so a filing is only treated as a layoff when its text says people are
 * leaving.
 */
const EDGAR = 'https://efts.sec.gov/LATEST/search-index'
export const SEC_USER_AGENT = 'NextChapter Justin Kulla support@launchyournextchapter.com'

export interface Edgar8K {
  company: string
  cik: string
  adsh: string
  fileDate: string
  document: string
  url: string
  state: string | null
}

interface EdgarHit {
  _id: string
  _source: { ciks?: string[]; display_names?: string[]; adsh?: string; file_date?: string; items?: string[]; biz_states?: string[] }
}

/** "Azenta, Inc.  (AZTA)  (CIK 0000933974)" is "Azenta, Inc.". */
export function companyFromDisplayName(display: string): string {
  return display.replace(/\s+\(CIK \d+\)\s*$/, '').replace(/\s+\([A-Z.\-]{1,6}(?:,\s*[A-Z.\-]{1,6})*\)\s*$/, '').replace(/\s+/g, ' ').trim()
}

/** A filing's address on sec.gov, from the search hit. */
export function filingUrl(cik: string, adsh: string, document: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${adsh.replace(/-/g, '')}/${document}`
}

export function parseEdgarHits(body: unknown): Edgar8K[] {
  const hits = ((body as { hits?: { hits?: EdgarHit[] } })?.hits?.hits ?? []) as EdgarHit[]
  const out: Edgar8K[] = []
  for (const h of hits) {
    const s = h._source
    if (!s?.items?.includes('2.05') || !s.display_names?.[0] || !s.ciks?.[0] || !s.adsh || !s.file_date) continue
    const document = h._id.split(':')[1]
    if (!document) continue
    out.push({
      company: companyFromDisplayName(s.display_names[0]),
      cik: s.ciks[0], adsh: s.adsh, fileDate: s.file_date, document,
      url: filingUrl(s.ciks[0], s.adsh, document), state: s.biz_states?.[0] ?? null,
    })
  }
  return out
}

const LAYOFF_TEXT = /\b(reduction in (?:its |our |the )?(?:global |total )?(?:workforce|force|headcount)|workforce reduction|reduce (?:its |our |the )?(?:global |total )?(?:workforce|headcount)|lay(?:ing|s)? off|laid off|reduction[- ]in[- ]force|eliminat\w+ (?:approximately |about |up to )?[\d,]+ (?:positions|jobs|roles|employees)|terminat\w+ (?:approximately |about )?[\d,]+ employees|severance)\b/i

/** Whether the filing's text says people are being let go, and how many if it says. */
export function readLayoffFiling(text: string): { isLayoff: boolean; employees: number | null; percent: number | null } {
  if (!LAYOFF_TEXT.test(text)) return { isLayoff: false, employees: null, percent: null }
  const m = text.match(/\b(?:approximately|about|up to|roughly)?\s*(\d[\d,]*)\s+(?:full-time\s+)?(?:employees|positions|jobs|roles|team members)\b/i)
  const n = m ? parseInt(m[1].replace(/,/g, ''), 10) : NaN
  return { isLayoff: true, employees: Number.isFinite(n) && n >= 5 && n < 500_000 ? n : null, percent: readPercent(text) }
}

/** The day-count window of Item 2.05 filings, newest first. */
export async function fetchItem205(days = 3, now: Date = new Date()): Promise<Edgar8K[]> {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const url = `${EDGAR}?q=${encodeURIComponent('"Item 2.05"')}&forms=8-K&dateRange=custom&startdt=${iso(new Date(now.getTime() - days * 86_400_000))}&enddt=${iso(now)}`
  const res = await fetch(url, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`EDGAR search answered ${res.status}`)
  return parseEdgarHits(await res.json()).sort((a, b) => b.fileDate.localeCompare(a.fileDate))
}

export { sameEmployer }
