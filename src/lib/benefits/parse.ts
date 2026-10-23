import { normalizeOrgName } from '../text/org-name-match'
import type { BenefitCategory, BenefitProgramRow } from './types'

/**
 * Turns the research tables (markdown, one table per state or section, columns differ by file)
 * into catalog rows. Columns are found by header name, so files may order them differently.
 * Nothing is invented: a row without a name is skipped, and only an explicit Y/V/Yes in the
 * verification column marks a row verified.
 */

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
  maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}
const CODES = new Set(Object.values(STATES))

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)
const clean = (s: string | undefined) => (s ?? '').replace(/\*\*/g, '').replace(/`/g, '').trim()

type Col = 'employer' | 'city' | 'name' | 'state' | 'provider' | 'amount' | 'eligibility' | 'status' | 'url' | 'verified' | 'segment' | 'cost' | 'locality'
function colFor(h: string): Col | null {
  const x = h.toLowerCase()
  if (/^#$/.test(x)) return null
  if (/verif|^ver$/.test(x)) return 'verified'
  if (/url|link/.test(x)) return 'url'
  if (/^state/.test(x)) return 'state'
  if (/status/.test(x)) return 'status'
  if (/eligib/.test(x)) return 'eligibility'
  if (/segment/.test(x)) return 'segment'
  if (/^employer|^company/.test(x)) return 'employer'
  if (/^city|^town/.test(x)) return 'city'
  if (/location|locality/.test(x)) return 'locality'
  if (/^cost/.test(x)) return 'cost'
  if (/provider|^org|organi[sz]ation|agency|issued/.test(x)) return 'provider'
  if (/pays|get|provides|benefit|amount|value|incentive/.test(x)) return 'amount'
  if (/name|program/.test(x)) return 'name'
  return null
}

function statusOf(text: string): BenefitProgramRow['status'] {
  const t = text.toLowerCase()
  if (/\b(closed|lapsed|ended|expired|sunset|discontinued|no longer|not accepting|paused)\b/.test(t)) return 'CLOSED'
  if (/\b(rolling|ongoing|year-round|continuous)\b/.test(t)) return 'ROLLING'
  if (/\b(open|active|available|accepting|in effect|live)\b/.test(t)) return 'OPEN'
  return 'UNKNOWN'
}

function splitRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split(/\s\|\s|\|/).map((c) => clean(c))
}

export function parseCatalog(markdown: string, category: BenefitCategory, source: string, checkedAt: Date): BenefitProgramRow[] {
  const out: BenefitProgramRow[] = []
  let cols: (Col | null)[] | null = null
  let hash = false
  let headingState: string | null = null
  const seen = new Set<string>()
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    const h = /^#{1,4}\s+(.*)$/.exec(line)
    if (h) {
      const key = clean(h[1]).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
      headingState = STATES[key] ?? Object.entries(STATES).find(([n]) => key.startsWith(n))?.[1] ?? null
      continue
    }
    if (!line.includes('|')) continue
    if (/^\|?[\s:|-]+\|?$/.test(line)) continue
    const cells = splitRow(line)
    if (cells.length < 4) continue
    const mapped = cells.map(colFor)
    if (mapped.includes('name') && mapped.includes('url') && !cells.some((c) => /^https?:/.test(c))) {
      hash = cells[0] === '#'
      cols = hash ? mapped.slice(1) : mapped
      continue
    }
    if (!cols) continue
    let fields = cells
    if ((hash || fields.length === cols.length + 1) && /^\d+$/.test(fields[0])) fields = fields.slice(1)
    const get = (c: Col) => { const i = cols!.indexOf(c); return i >= 0 ? fields[i] || undefined : undefined }
    const name = get('name')
    if (!name || name.length < 3) continue
    const stateRaw = (get('state') ?? '').toUpperCase().trim()
    const state = CODES.has(stateRaw) ? stateRaw : headingState
    const urlRaw = get('url') ?? fields.find((f) => /^https?:\/\//.test(f))
    const url = urlRaw && /^https?:\/\/\S+/.test(urlRaw) ? urlRaw.match(/^https?:\/\/\S+/)![0].replace(/[),.;]+$/, '') : null
    const ver = (get('verified') ?? '').trim().toLowerCase()
    const doubt = /uncertain|unconfirmed|not found|\b404\b|unverified|stale|conflict|dissolved|confirm\b/i
    const verified = /^(y|v|yes)\b/.test(ver) && !doubt.test(`${get('status') ?? ''} ${get('eligibility') ?? ''}`)
    const statusText = get('status') ?? ''
    const amount = [get('amount'), get('cost')].filter(Boolean).join(' · ') || null
    const id = `${category.toLowerCase()}:${state ?? 'us'}:${slug(name)}`
    if (seen.has(id)) continue
    seen.add(id)
    const seg = get('segment')
    const employer = get('employer')?.slice(0, 120) ?? null
    out.push({
      id, category, name: name.slice(0, 200), provider: get('provider') ?? null, scope: state ? 'STATE' : 'NATIONAL', state: state ?? null,
      locality: get('locality') ?? null, amount: amount ? amount.slice(0, 400) : null, eligibility: get('eligibility')?.slice(0, 500) ?? null,
      status: statusOf(statusText), statusNote: statusText ? statusText.slice(0, 300) : null, url,
      segments: seg ? [seg.slice(0, 80)] : [], city: get('city')?.slice(0, 80) ?? null, employer, employerKey: employer ? normalizeOrgName(employer) : null, geoAreaId: null, verified: verified && !!url, checkedAt: verified ? checkedAt : null, source,
    })
  }
  return out
}
