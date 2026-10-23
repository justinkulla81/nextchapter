// Turns a researched row into a catalog row: closed vocabularies enforced, unknowns kept null, and the
// rules the page relies on applied (a published row has a link and was verified; past dates are dropped).
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { SEGMENTS, TAXONOMY } from './taxonomy'
import { ACCESS, FORMATS, JOURNEYS, KINDS, PROGRAM_FORMATS, SENIORITIES, SESSION_FORMATS, SPEAKING } from './types'

type Raw = Record<string, unknown>

const str = (v: unknown, max = 400): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const url = (v: unknown): string | null => { const s = str(v, 600); return s && /^https?:\/\//i.test(s) ? s : null }
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null)
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(String(v)) ? (v as T) : fallback)
const only = (v: unknown, allowed: readonly string[]): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : [])
export const slug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export interface Problem { id: string; message: string }

export function normalizeRow(raw: Raw, today = '2026-10-23'): { row: Record<string, unknown> | null; problems: string[] } {
  const problems: string[] = []
  const name = str(raw.name, 160)
  const link = url(raw.url)
  if (!name) return { row: null, problems: ['no name'] }
  if (!link) return { row: null, problems: ['no event link'] }
  const id = slug(str(raw.id, 100) ?? name)

  let start = day(raw.startDate)
  let end = day(raw.endDate)
  let confirmed = raw.datesConfirmed === true && !!start
  if (start && (end ?? start) < today) { problems.push(`dates already past (${start}); dropped`); start = null; end = null; confirmed = false }
  if (end && start && end < start) { problems.push('end before start; end dropped'); end = null }

  const access = pick(raw.access, ACCESS, 'PAID')
  let costLow = int(raw.costLow)
  let costHigh = int(raw.costHigh)
  if (costLow != null && costHigh != null && costLow > costHigh) [costLow, costHigh] = [costHigh, costLow]
  if (access === 'FREE' || access === 'INVITE') { costLow = null; costHigh = null }

  const verified = raw.verified === true
  const industries = only(raw.industries, INDUSTRY_BUCKET_NAMES)
  const functions = only(raw.functions, PRIMARY_FUNCTION_OPTIONS)
  if (Array.isArray(raw.industries) && industries.length !== raw.industries.length) problems.push('unknown industry name dropped')
  if (Array.isArray(raw.functions) && functions.length !== raw.functions.length) problems.push('unknown function name dropped')

  const segments = only(raw.segments, SEGMENTS)
  const allRoles = new Set(Object.values(TAXONOMY).flatMap((segs) => Object.values(segs).flat()))
  // Roles come from the taxonomy; a role the taxonomy lacks is kept lower-cased so it is not lost, but flagged.
  const roles = [...new Set((Array.isArray(raw.roles) ? raw.roles : []).filter((x): x is string => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 12)
  if (roles.some((r) => !allRoles.has(r.toLowerCase()) && ![...allRoles].some((a) => a.toLowerCase() === r))) problems.push('role outside the taxonomy kept')
  if (Array.isArray(raw.segments) && segments.length !== raw.segments.length) problems.push('unknown segment dropped')
  const programFormats = only(raw.programFormats, PROGRAM_FORMATS)
  let speaking = pick(raw.speaking, SPEAKING, 'UNKNOWN')
  // Keynotes, panels, workshops or breakouts mean outside speakers exist even when no call is posted.
  const kindOf = pick(raw.kind, KINDS, 'CONFERENCE')
  if (speaking === 'UNKNOWN' && programFormats.some((f) => (SESSION_FORMATS as readonly string[]).includes(f))) speaking = 'LIKELY'
  // A conference, summit or workshop is built from sessions, so speakers exist even when the program is not listed.
  else if (speaking === 'UNKNOWN' && kindOf !== 'TRADE_SHOW') speaking = 'LIKELY'
  const row = {
    id, name, organizer: str(raw.organizer, 120), url: link,
    kind: kindOf, format: pick(raw.format, FORMATS, 'IN_PERSON'),
    startDate: start, endDate: end, datesConfirmed: confirmed, typicalMonth: str(raw.typicalMonth, 30),
    city: str(raw.city, 80), state: str(raw.state, 2)?.toUpperCase() ?? null, country: str(raw.country, 40) ?? 'US',
    industries, functions, segments, roles, journeys: only(raw.journeys, JOURNEYS), programFormats, seniorities: only(raw.seniorities, SENIORITIES),
    importance: [1, 2, 3].includes(Number(raw.importance)) ? Number(raw.importance) : 2,
    whyAttend: str(raw.whyAttend, 300),
    access, costLow, costHigh, costNote: str(raw.costNote, 300),
    speaking, speakingUrl: speaking === 'OPEN_CFP' || speaking === 'BY_INVITE' || speaking === 'LIKELY' ? url(raw.speakingUrl) : null,
    speakingDeadline: speaking === 'OPEN_CFP' ? day(raw.speakingDeadline) : null, speakingNote: str(raw.speakingNote, 300),
    cheaperWays: str(raw.cheaperWays, 400),
    applyUrl: access === 'INVITE' || access === 'APPLY' ? url(raw.applyUrl) : null,
    applyDeadline: access === 'APPLY' ? day(raw.applyDeadline) : null,
    verified,
    // A candidate sees a row only when someone checked it against the event's own site.
    published: verified && !!(start || str(raw.typicalMonth, 30)),
    checkedAt: verified ? day(raw.checkedAt) ?? today : null,
    source: str(raw.source, 80) ?? 'research',
    adminNote: str(raw.adminNote, 400),
  }
  if (verified && !row.startDate && !row.typicalMonth) problems.push('verified but no dates and no usual month')
  return { row, problems }
}
