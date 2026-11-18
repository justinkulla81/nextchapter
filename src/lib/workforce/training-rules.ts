// Education Hub, pure parts: the three places training comes from, who an offering is for (industry, experience band, function),
// and who it matches. No database here.

import { MIN_GROUP, seniorityBand } from './skills-intel'

export const TRAINING_SOURCES = [
  { key: 'UNIVERSITY', label: 'Universities and colleges', hint: 'A degree, certificate or executive program from a college.' },
  { key: 'THIRD_PARTY', label: 'Third-party training', hint: 'A course from a provider such as Coursera, a bootcamp or a professional body.' },
  { key: 'LOCAL', label: 'Offered by Louisville', hint: 'Training the region runs itself, including courses NextChapter builds for it.' },
] as const
export type TrainingSource = (typeof TRAINING_SOURCES)[number]['key']
export const isTrainingSource = (v: unknown): v is TrainingSource => TRAINING_SOURCES.some((s) => s.key === v)
export const sourceLabel = (k: string) => TRAINING_SOURCES.find((s) => s.key === k)?.label ?? k

/** The experience bands an offering can be aimed at (the same bands skills intelligence uses). */
export const EXPERIENCE_BANDS = ['Individual contributor', 'Manager', 'Director or above'] as const
export type ExperienceBand = (typeof EXPERIENCE_BANDS)[number]

export const ASSIGNMENTS = ['LISTED', 'ASSIGNED'] as const
export type Assignment = (typeof ASSIGNMENTS)[number]

/** What an offering is aimed at. An empty list means everyone on that dimension. */
export type Audience = { industries: string[]; functions: string[]; levels: string[] }
/** What we know about a person, coarsely. */
export type Who = { industry: string | null; function: string | null; level: string | null; years: number | null }

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Does this offering fit this person? Every dimension the offering names must include the person's value; a dimension it leaves empty
 * matches anyone. A person with no value on a dimension the offering names does not match (we never guess someone into a track).
 */
export function audienceMatches(a: Audience, who: Who): boolean {
  const band = seniorityBand(who.level, who.years)
  const ok = (wanted: string[], value: string | null) => wanted.length === 0 || (value !== null && wanted.some((w) => norm(w) === norm(value)))
  return ok(a.industries, who.industry) && ok(a.functions, who.function) && ok(a.levels, band)
}

/** Why it was shown: the dimensions that narrowed it, in words. */
export function audienceLine(a: Audience): string {
  const parts = [a.functions.length ? a.functions.join(', ') : null, a.industries.length ? a.industries.join(', ') : null, a.levels.length ? a.levels.join(', ') : null].filter(Boolean)
  return parts.length ? `For ${parts.join(' · ')}` : 'For everyone in the group'
}

/** Keep only values from the allowed list (case-insensitive), once each, in the list's spelling. */
export function pick(values: string[], allowed: readonly string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const hit = allowed.find((a) => norm(a) === norm(v))
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out
}

/** Free-text skills: trimmed, deduplicated, short, at most 12. */
export function cleanSkills(raw: string): string[] {
  const out: string[] = []
  for (const part of raw.split(/[,\n]/)) {
    const s = part.trim().slice(0, 60)
    if (s && !out.some((o) => norm(o) === norm(s))) out.push(s)
  }
  return out.slice(0, 12)
}

const URL_OK = /^https?:\/\//i
export type OfferingInput = {
  source: TrainingSource
  title: string
  provider: string
  url: string
  summary: string
  skills: string[]
  hours: number | null
  priceCents: number
  wioaEligible: boolean
  ncCustom: boolean
} & Audience

/** Checks one offering as typed. Returns an error in plain words, or the cleaned value. */
export function validateOffering(f: { get: (k: string) => string | null; getAll: (k: string) => string[] }, allowed: { industries: readonly string[]; functions: readonly string[] }): { error: string } | { value: OfferingInput } {
  const s = (k: string, max: number) => (f.get(k) ?? '').trim().slice(0, max)
  const source = s('source', 20)
  if (!isTrainingSource(source)) return { error: 'Pick where this training comes from.' }
  const title = s('title', 160)
  if (!title) return { error: 'Add the name of the training.' }
  const url = s('url', 500)
  if (url && !URL_OK.test(url)) return { error: 'The link must start with http:// or https://.' }
  const hoursRaw = s('hours', 6)
  const hours = hoursRaw ? Number(hoursRaw) : null
  if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 5000)) return { error: 'Hours must be a number, such as 12.' }
  const priceRaw = s('price', 8)
  const price = priceRaw ? Number(priceRaw) : 0
  if (!Number.isFinite(price) || price < 0 || price > 100000) return { error: 'The price must be a number in dollars, such as 250, or blank for free.' }
  return {
    value: {
      source, title, provider: s('provider', 120), url, summary: s('summary', 600), skills: cleanSkills(f.get('skills') ?? ''),
      hours: hours === null ? null : Math.round(hours), priceCents: Math.round(price * 100), wioaEligible: f.get('wioaEligible') === 'on', ncCustom: source === 'LOCAL' && f.get('ncCustom') === 'on',
      industries: pick(f.getAll('industries'), allowed.industries), functions: pick(f.getAll('functions'), allowed.functions), levels: pick(f.getAll('levels'), EXPERIENCE_BANDS),
    },
  }
}

/** How many of the group an audience reaches, hidden under MIN_GROUP so a small number never points at a person. */
export function reach(people: Who[], a: Audience): number | null {
  const n = people.filter((p) => audienceMatches(a, p)).length
  return n > 0 && n < MIN_GROUP ? null : n
}

/** Which skills the catalog teaches, by how many active offerings name them (lower-cased). */
export function coveredSkills(offerings: { skills: string[] }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const o of offerings) for (const k of new Set(o.skills.map(norm))) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}
