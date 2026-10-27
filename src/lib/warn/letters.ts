import { extractText, getDocumentProxy } from 'unpdf'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { WARN_USER_AGENT, type WarnRow } from './sources'

// Hawaii, Minnesota and West Virginia list each notice as a link to the employer's own letter or page, and the list itself carries no
// place and no headcount. The place and the headcount are in the letter, so a notice's workforce board and size come from reading it.

export interface LetterRow extends WarnRow {
  /** The notice's own page (Hawaii) or letter (Minnesota, West Virginia). */
  letterUrl?: string
}

const AGENCY_ZIPS = new Set(['25305', '55101', '55155']) // the state office the letter is addressed to
const STATE_WORDS: Record<string, string> = { HI: 'Hawaii', MN: 'Minnesota', WV: 'West Virginia' }

/**
 * The city a letter says the layoff is in: "...located at 3800 Annapolis Ln, Plymouth, MN 55447". The first "City, ST zip" after a
 * phrase that points at the worksite wins; otherwise the first one that is not the state office the letter is sent to.
 */
export function letterPlace(text: string, state: string): string | null {
  const t = text.replace(/\s+/g, ' ')
  const st = state.toUpperCase()
  const name = STATE_WORDS[st] ?? st
  const re = new RegExp(`((?:(?:St|Saint|Fort|Mt|Mount)\\.? )?[A-Z][A-Za-z.'’‘ʻ-]+(?: [A-Z][A-Za-z.'’‘ʻ-]+){0,2}),? (?:${st}|${name}),? (\\d{5})`, 'g')
  const found = [...t.matchAll(re)].filter((m) => !AGENCY_ZIPS.has(m[2]))
  if (found.length === 0) return null
  const pointer = /(located at|facility at|site address|worksite|work site|plant at|operations at|premises at|mine located)/i
  const pick = found.find((m) => pointer.test(t.slice(Math.max(0, m.index! - 160), m.index!))) ?? found[0]
  // "Ave, Plymouth" — a street suffix swallowed into the name: keep the last words after it.
  const city = pick[1].replace(/^.*\b(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Ln|Lane|Dr|Drive|Hwy|Highway|Way|Pkwy|Suite|Ste)\.?,? /i, '').trim()
  // "NW Medford": a compass prefix on the street line, not part of the city.
  return city.replace(/^(?:[NSEW]{1,2}\.? )(?=[A-Z][a-z])/, '') || null
}

/** The headcount a letter gives for the layoff, or null when it names none plainly. */
export function letterEmployees(text: string): number | null {
  const t = text.replace(/\s+/g, ' ')
  const hit =
    t.match(/\((\d{1,5})\)\s+(?:full[- ]time |affected )?(?:employees|workers|individuals|positions)/i) ??
    t.match(/(?:approximately|approx\.?|about|up to)\s+(\d{1,5})\s+(?:employees|workers|positions|individuals)/i) ??
    t.match(/\b(\d{1,5})\s+(?:employees|workers)\s+(?:will|are expected|to be|may|who)/i)
  const n = hit ? parseInt(hit[1], 10) : NaN
  return Number.isFinite(n) && n > 0 && n < 50_000 ? n : null
}

const HI_COUNTY: [RegExp, string][] = [
  [/kaua[ʻ‘']?i|lihue|kapaa|princeville|hanalei|poipu|waimea,? kauai/i, 'Kauai'],
  [/maui|lahaina|kahului|wailuku|kihei|lanai|lāna|molokai|moloka/i, 'Maui'],
  [/hilo|kona|kohala|waikoloa|big island|island of hawai|pahoa|kamuela|volcano/i, 'Hawaii'],
  [/honolulu|oahu|o[ʻ‘']ahu|kapolei|pearl|waipahu|kailua|kaneohe|kāne|laie|lāie|ewa|aiea|mililani|wahiawa|waianae|kaimuki|waikiki|kalihi|hawaii kai|haleiwa|ala moana|pearl harbor|hickam|96[78]\d\d/i, 'Honolulu'],
]

/** The island a Hawaii notice is on, when a name or address says so ("JINYA Ramen Bar – Honolulu"); null when it does not. */
export const hawaiiCountyFromText = (text: string): string | null => HI_COUNTY.find(([re]) => re.test(text))?.[1] ?? null

/** A Hawaii notice's own page: the worksite, the island it is on, and the headcount. */
export function parseHawaiiNotice(html: string): { address: string | null; county: string | null; employees: number | null } {
  const body = html.match(/<main[\s\S]*?<\/main>|<article[\s\S]*?<\/article>/i)?.[0] ?? html
  const text = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  const site = text.match(/(?:Affected Worksite|Worksite|Site)[^:]*:\s*(.{5,200}?)(?:Contact|Number of|Date of|Additional|$)/i)?.[1] ?? ''
  // The island comes from the worksite when it names one, then from the whole page.
  const county = [site, text].map((s) => HI_COUNTY.find(([re]) => re.test(s))?.[1] ?? null).find(Boolean) ?? null
  const employees = (() => {
    const hit =
      text.match(/(?:expected|anticipated) to be (?:separated|laid off)[^:\d]{0,30}:?\s*(?:approximately\s*)?(\d{1,5})/i) ??
      text.match(/(?:to be laid off|laid off)[^:\d]{0,30}:\s*(?:approximately\s*)?(\d{1,5})/i) ??
      text.match(/Total employees (?:affected|expected to be separated)[^:\d]{0,20}:\s*(?:approximately\s*)?(\d{1,5})/i) ??
      text.match(/approximately (\d{1,5}) employees are anticipated to be separated/i)
    const n = hit ? parseInt(hit[1], 10) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  })()
  return { address: site.replace(/\s+/g, ' ').trim().slice(0, 200) || null, county, employees }
}

/** Minnesota's list: "<li><a href=letter.pdf>Employer</a> - M/D/YYYY". A "(Revision)" line updates a notice already listed. */
export function parseMinnesotaPage(html: string): LetterRow[] {
  const out: LetterRow[] = []
  for (const m of html.matchAll(/<li><a href="([^"]+\.pdf)"[^>]*>([^<]{2,120})<\/a>\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi)) {
    if (/\(revision/i.test(m[2])) continue
    const [mo, d, y] = m[3].split('/').map((x) => parseInt(x, 10))
    const noticeDate = new Date(Date.UTC(y < 100 ? 2000 + y : y, mo - 1, d))
    const employer = m[2].replace(/&amp;/g, '&').trim()
    out.push({
      state: 'MN', employer, normalizedEmployer: normalizeOrgName(employer), noticeDate, effectiveDate: null, employees: null,
      layoffType: null, county: null, address: null, industry: null, letterUrl: new URL(m[1], 'https://mn.gov').toString(),
    })
  }
  return out
}

async function pdfText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': WARN_USER_AGENT }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()))
  return (await extractText(pdf, { mergePages: true })).text
}

/**
 * Fills the place and the headcount a row lacks from its letter, one request each, newest first, up to `budget` letters. A letter that
 * will not load or names no place leaves the row as it was.
 */
export async function enrichFromLetters(rows: LetterRow[], budget: number): Promise<LetterRow[]> {
  const todo = rows.filter((r) => r.letterUrl && (!r.address || r.employees == null) && !r.county).sort((a, b) => (b.noticeDate?.getTime() ?? 0) - (a.noticeDate?.getTime() ?? 0))
  for (const row of todo) {
    if (budget-- <= 0) break
    await new Promise((r) => setTimeout(r, 250))
    try {
      if (row.state === 'HI') {
        const res = await fetch(row.letterUrl!, { headers: { 'User-Agent': WARN_USER_AGENT }, signal: AbortSignal.timeout(30_000) })
        if (!res.ok) continue
        const d = parseHawaiiNotice(await res.text())
        row.county ??= d.county
        row.address ??= d.address
        row.employees ??= d.employees
      } else {
        const text = await pdfText(row.letterUrl!)
        const city = letterPlace(text, row.state!)
        if (city) row.address ??= `${city} ${row.state}`
        row.employees ??= letterEmployees(text)
      }
    } catch (e) {
      console.error(`${row.state}: letter for ${row.employer} was skipped: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return rows
}
