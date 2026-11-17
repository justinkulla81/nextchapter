// What an organization may write on its own public page, and how it is checked. Pure: no database, so the forms, the
// server actions, the public pages and the tests share one definition (owner decision 2026-11-17).
//
// Never editable here: anything sourced (federal college data, layoff filings, labor statistics, job counts, pay). The
// page shows this content as the organization's own words, beside the sourced sections, and adds no sign-up ask.

export type PublicPageKind = 'COLLEGE' | 'WORKFORCE' | 'EMPLOYER'

export type PublicEvent = { title: string; date: string; url: string | null }
export type PublicPageContentData = {
  intro: string | null
  highlights: string[]
  events: PublicEvent[]
  contact: { website: string | null; email: string | null; phone: string | null; address: string | null; hours: string | null }
  // Copied from the organization's portal branding when it saves, so the public page needs one read.
  imageUrl: string | null
  logoUrl: string | null
  tagline: string | null
  productImageUrl: string | null
  productName: string | null
}

export const LIMITS = { intro: 700, highlight: 120, highlights: 6, eventTitle: 100, events: 6, address: 200, hours: 120 } as const

// What each kind of organization calls the two lists.
export const LABELS: Record<PublicPageKind, { highlights: string; highlightsHelp: string; events: string; website: string }> = {
  COLLEGE: { highlights: 'For alumni', highlightsHelp: 'Programs, services and employers you want alumni to know about. One per line.', events: 'Career fairs and events', website: 'Career center page' },
  WORKFORCE: { highlights: 'Services', highlightsHelp: 'What you offer job seekers and employers. One per line.', events: 'Hiring events and workshops', website: 'Website' },
  EMPLOYER: { highlights: 'Why work here', highlightsHelp: 'Benefits, culture and what makes the work worth doing. One per line.', events: 'Hiring events', website: 'Careers page' },
}

export const EMPTY_CONTENT: PublicPageContentData = {
  intro: null, highlights: [], events: [], contact: { website: null, email: null, phone: null, address: null, hours: null },
  imageUrl: null, logoUrl: null, tagline: null, productImageUrl: null, productName: null,
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').trim() : '')

function cleanUrl(v: unknown): string | null | undefined {
  const s = clean(v)
  if (!s) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

export type ParseResult = { ok: true; content: PublicPageContentData } | { ok: false; error: string }

// Reads the editor's form. Every problem is said in plain words and nothing typed is lost (the form keeps its values).
export function parsePublicPageForm(f: { get(name: string): unknown; getAll?(name: string): unknown[] }): ParseResult {
  const intro = clean(f.get('intro')).replace(/\r/g, '')
  if (intro.length > LIMITS.intro) return { ok: false, error: `Keep the introduction under ${LIMITS.intro} characters (it is ${intro.length}).` }
  const highlights = clean(f.get('highlights')).split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
  if (highlights.length > LIMITS.highlights) return { ok: false, error: `List up to ${LIMITS.highlights} highlights, one per line.` }
  const long = highlights.find((h) => h.length > LIMITS.highlight)
  if (long) return { ok: false, error: `Keep each highlight under ${LIMITS.highlight} characters: “${long.slice(0, 40)}…” is longer.` }
  const events: PublicEvent[] = []
  for (let i = 0; i < LIMITS.events; i++) {
    const title = clean(f.get(`event-title-${i}`))
    const date = clean(f.get(`event-date-${i}`))
    const rawUrl = f.get(`event-url-${i}`)
    if (!title && !date && !clean(rawUrl)) continue
    if (!title) return { ok: false, error: `Event ${i + 1} needs a name.` }
    if (title.length > LIMITS.eventTitle) return { ok: false, error: `Keep event ${i + 1}'s name under ${LIMITS.eventTitle} characters.` }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: `Event ${i + 1} needs a date.` }
    const url = cleanUrl(rawUrl)
    if (url === undefined) return { ok: false, error: `Event ${i + 1}'s link is not a web address.` }
    events.push({ title, date, url })
  }
  const website = cleanUrl(f.get('website'))
  if (website === undefined) return { ok: false, error: 'The website is not a web address.' }
  const email = clean(f.get('email')).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'The contact email is not an email address.' }
  const phone = clean(f.get('phone'))
  if (phone && !/^[0-9+().\-\s]{7,25}$/.test(phone)) return { ok: false, error: 'The phone number has characters a phone number does not use.' }
  const address = clean(f.get('address'))
  const hours = clean(f.get('hours'))
  if (address.length > LIMITS.address || hours.length > LIMITS.hours) return { ok: false, error: `Keep the address under ${LIMITS.address} characters and the hours under ${LIMITS.hours}.` }
  return {
    ok: true,
    content: {
      ...EMPTY_CONTENT,
      intro: intro || null,
      highlights,
      events: events.sort((a, b) => a.date.localeCompare(b.date)),
      contact: { website, email: email || null, phone: phone || null, address: address || null, hours: hours || null },
    },
  }
}

export function readContent(json: unknown): PublicPageContentData | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Partial<PublicPageContentData>
  return { ...EMPTY_CONTENT, ...o, contact: { ...EMPTY_CONTENT.contact, ...(o.contact ?? {}) }, highlights: Array.isArray(o.highlights) ? o.highlights : [], events: Array.isArray(o.events) ? o.events : [] }
}

// Events still to come (or today), as of `today` (YYYY-MM-DD).
export const upcomingEvents = (c: PublicPageContentData, today: string) => c.events.filter((e) => e.date >= today)

export const hasAnything = (c: PublicPageContentData | null): c is PublicPageContentData =>
  !!c && !!(c.intro || c.highlights.length || c.events.length || Object.values(c.contact).some(Boolean) || c.imageUrl || c.tagline)

// The raw text fields of the editor's form, handed back after a failed save so nothing typed is lost.
export function formValues(f: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, val] of f.entries()) if (typeof val === 'string' && !k.startsWith('$')) out[k] = val
  return out
}
