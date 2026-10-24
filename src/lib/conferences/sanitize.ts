// Closed-vocabulary cleanup of whatever the model returned. Pure, so it is tested without a model.
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { SENIORITIES, FORMATS } from '@/lib/events/types'
import { OPPORTUNITY_TYPES, type OpportunityType } from './constants'
import type { SeenOpportunity } from './changes'

export interface Extraction {
  name: string | null
  organizer: string | null
  startDate: string | null
  endDate: string | null
  format: string | null
  city: string | null
  state: string | null
  country: string | null
  costLow: number | null
  costHigh: number | null
  costNote: string | null
  industries: string[]
  functions: string[]
  seniorities: string[]
  whyAttend: string | null
  opportunities: SeenOpportunity[]
}

const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null)
const money = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100_000 ? Math.round(v) : null)
const only = (v: unknown, allowed: readonly string[]): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : [])

function absUrl(v: unknown, base: string): string | null {
  const s = str(v, 600)
  if (!s) return null
  try {
    const u = new URL(s, base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch { return null }
}

export function sanitizeExtraction(raw: Record<string, unknown>, baseUrl: string): Extraction {
  const startDate = day(raw.startDate)
  let endDate = day(raw.endDate)
  if (startDate && endDate && endDate < startDate) endDate = startDate
  if (!startDate) endDate = null
  const low = money(raw.costLow)
  const high = money(raw.costHigh)
  const opps: SeenOpportunity[] = []
  const seen = new Set<string>()
  for (const o of Array.isArray(raw.opportunities) ? raw.opportunities.slice(0, 20) : []) {
    if (!o || typeof o !== 'object') continue
    const r = o as Record<string, unknown>
    const type = String(r.type) as OpportunityType
    const title = str(r.title, 160)
    if (!OPPORTUNITY_TYPES.includes(type) || !title) continue
    const key = `${type}|${title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    opps.push({ type, title, url: absUrl(r.url, baseUrl), opensAt: day(r.opensAt), deadline: day(r.deadline) })
  }
  const state = str(raw.state, 4)?.toUpperCase() ?? null
  return {
    name: str(raw.name, 160),
    organizer: str(raw.organizer, 160),
    startDate, endDate,
    format: (FORMATS as readonly string[]).includes(String(raw.format)) ? String(raw.format) : null,
    city: str(raw.city, 80),
    state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    country: str(raw.country, 2)?.toUpperCase() ?? null,
    costLow: low, costHigh: low != null && high != null && high < low ? low : high,
    costNote: str(raw.costNote, 160),
    industries: only(raw.industries, INDUSTRY_BUCKET_NAMES),
    functions: only(raw.functions, PRIMARY_FUNCTION_OPTIONS),
    seniorities: only(raw.seniorities, SENIORITIES),
    whyAttend: str(raw.whyAttend, 200),
    opportunities: opps,
  }
}

/** Which card fields are empty, so the form can nudge without blocking. */
export function missingFields(e: Extraction): string[] {
  const out: string[] = []
  if (!e.name) out.push('name')
  if (!e.startDate) out.push('dates')
  if (!e.city && e.format !== 'VIRTUAL') out.push('location')
  if (e.industries.length === 0) out.push('industries')
  if (e.functions.length === 0) out.push('functions')
  return out
}
