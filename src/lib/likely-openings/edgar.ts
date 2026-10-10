// Minimal SEC EDGAR client. Free, no key — but SEC requires a descriptive
// User-Agent with a contact email and caps traffic at 10 requests/second
// (https://www.sec.gov/os/accessing-edgar-data). We stay under ~8/s.

export const SEC_USER_AGENT = 'NextChapter justin@launchyournextchapter.com'
const MIN_GAP_MS = 125

let nextSlot = 0
async function throttle() {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

export async function secFetch(url: string, attempt = 0): Promise<string> {
  await throttle()
  const res = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT, 'Accept-Encoding': 'gzip, deflate' },
    cache: 'no-store',
  })
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) * 2))
    return secFetch(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`SEC ${res.status} for ${url}`)
  return res.text()
}

export interface EftsHit {
  accessionNumber: string // 0001234567-26-000001
  fileName: string // primary document within the filing
  cik: string // no leading zeros
  companyName: string // display name without ticker/CIK suffix
  form: string
  fileDate: string // YYYY-MM-DD
  items: string[]
  sics: string[]
  fileNums: string[]
  location: string | null
}

function cleanDisplayName(display: string): string {
  // "Portillo's Inc.  (PTLO)  (CIK 0001871509)" -> "Portillo's Inc."
  return display.replace(/\s*\(CIK \d+\)\s*$/, '').replace(/\s*\([A-Z0-9.,\s-]+\)\s*$/, '').trim()
}

/**
 * Every filing of one form type on one day, via EDGAR full-text search's
 * index endpoint (returns item numbers for 8-Ks, which the daily form index
 * does not). One hit per filing's primary document; paged 100 at a time.
 */
export async function listFilingsForDay(form: '8-K' | 'D', day: string): Promise<EftsHit[]> {
  const out: EftsHit[] = []
  const seen = new Set<string>()
  for (let from = 0; from < 10_000; from += 100) {
    const url = `https://efts.sec.gov/LATEST/search-index?forms=${encodeURIComponent(form)}&dateRange=custom&startdt=${day}&enddt=${day}&from=${from}`
    const body = JSON.parse(await secFetch(url)) as {
      hits: { total: { value: number }; hits: { _id: string; _source: Record<string, unknown> }[] }
    }
    for (const h of body.hits.hits) {
      const s = h._source as {
        adsh: string; ciks: string[]; display_names: string[]; form: string; file_date: string
        items?: string[]; sics?: string[]; file_num?: string[]; biz_locations?: string[]
      }
      if (s.form !== form || seen.has(s.adsh)) continue
      seen.add(s.adsh)
      out.push({
        accessionNumber: s.adsh,
        fileName: h._id.split(':')[1] ?? '',
        cik: (s.ciks[0] ?? '').replace(/^0+/, ''),
        companyName: cleanDisplayName(s.display_names[0] ?? ''),
        form: s.form,
        fileDate: s.file_date,
        items: s.items ?? [],
        sics: s.sics ?? [],
        fileNums: s.file_num ?? [],
        location: s.biz_locations?.[0] ?? null,
      })
    }
    if (body.hits.hits.length < 100 || from + 100 >= body.hits.total.value) break
  }
  return out
}

export function filingDocUrl(hit: Pick<EftsHit, 'cik' | 'accessionNumber' | 'fileName'>): string {
  return `https://www.sec.gov/Archives/edgar/data/${hit.cik}/${hit.accessionNumber.replace(/-/g, '')}/${hit.fileName}`
}

/** The human-readable filing index page — what we link candidates/admins to. */
export function filingIndexUrl(hit: Pick<EftsHit, 'cik' | 'accessionNumber'>): string {
  return `https://www.sec.gov/Archives/edgar/data/${hit.cik}/${hit.accessionNumber.replace(/-/g, '')}/${hit.accessionNumber}-index.htm`
}
