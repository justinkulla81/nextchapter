// The weekly re-check of conference employer and speaker lists: which conferences are due, and which rows read from their
// own pages are safe to load. Pure, so the rules are tested (src/test/list-recheck.test.ts). The runner is
// scripts/events/list-recheck.ts; the scheduled task that drives it is described in docs/seo/list-recheck.md.

export const DAYS = 86_400_000
/** Conferences starting within this many days are due; top-tier (importance 1) ones within the longer window. */
export const WINDOW_DAYS = 120
export const TOP_TIER_WINDOW_DAYS = 240
export const MAX_ORGS = 30
export const MAX_PEOPLE = 25
/** Conferences a run reads (about one point of the weekly usage meter). */
export const MAX_PER_RUN = 20

export interface DueInput {
  id: string
  importance: number
  startDate: Date | null
  datesConfirmed: boolean
  contentHash: string | null
  url: string | null
}

export function isDue(c: DueInput, hasLists: boolean, lastHash: string | null | undefined, now = new Date()): boolean {
  if (!c.url || !c.datesConfirmed || !c.startDate) return false
  const days = (c.startDate.getTime() - now.getTime()) / DAYS
  if (days < 0 || days > (c.importance === 1 ? TOP_TIER_WINDOW_DAYS : WINDOW_DAYS)) return false
  if (!hasLists) return true
  // Had lists before: only re-read when the event's own site changed since the last read.
  return !!c.contentHash && !!lastHash && c.contentHash !== lastHash
}

/** Soonest first inside each tier, top tier first, capped for the run. */
export function pickDue<T extends DueInput>(rows: T[], max = MAX_PER_RUN): T[] {
  return [...rows].sort((a, b) => a.importance - b.importance || a.startDate!.getTime() - b.startDate!.getTime()).slice(0, max)
}

export interface RawOrg { conferenceId: string; name: string; role: string; year: number | null; sourceUrl: string }
export interface RawPerson { conferenceId: string; name: string; title?: string | null; organization?: string | null; kind?: string; sessionTitle?: string | null; year: number | null; sourceUrl: string }

const IMAGE_NAME = /\.(png|jpe?g|gif|svg|webp|avif)\b|[_-]\d{2,4}x\d{2,4}|^(logo|img|image|sponsor|banner|badge)[-_ ]?\d*$|^[a-z0-9]+[-_][a-z0-9]+[-_][a-z0-9-_]*$/i
const ROLES = new Set(['SPONSOR', 'EXHIBITOR', 'SPEAKER'])
const KINDS = new Set(['KEYNOTE', 'MODERATOR', 'PANELIST', 'SPEAKER'])
const yearOk = (y: unknown): y is number => typeof y === 'number' && Number.isInteger(y) && y >= 2025 && y <= 2028
const httpsUrl = (u: string) => /^https:\/\/[^\s]+$/.test(u)

/** A name that reads as a name: not a file name or logo label, a sensible length, no markup. */
export function plainName(name: string, max = 80): boolean {
  const n = name.trim()
  return n.length >= 2 && n.length <= max && !/[<>{}\[\]|]/.test(n) && !/^[\d\W]+$/.test(n) && n.split(/\s+/).length <= 9 && !IMAGE_NAME.test(n)
}

/** Keeps only rows that follow the rules (https source page, a year stated on the page, plain names), deduped, capped per conference. */
export function cleanOrgs(rows: RawOrg[], valid: Set<string>): RawOrg[] {
  const seen = new Set<string>()
  const per = new Map<string, number>()
  const out: RawOrg[] = []
  for (const r of rows) {
    if (!valid.has(r.conferenceId) || !ROLES.has(r.role) || !yearOk(r.year) || !httpsUrl(r.sourceUrl) || !plainName(r.name)) continue
    const key = `${r.conferenceId}|${r.name.trim().toLowerCase()}|${r.role}`
    if (seen.has(key)) continue
    const n = per.get(r.conferenceId) ?? 0
    if (n >= MAX_ORGS) continue
    seen.add(key)
    per.set(r.conferenceId, n + 1)
    out.push({ ...r, name: r.name.trim() })
  }
  return out
}

export function cleanPeople(rows: RawPerson[], valid: Set<string>): RawPerson[] {
  const seen = new Set<string>()
  const per = new Map<string, number>()
  const out: RawPerson[] = []
  for (const r of rows) {
    const kind = r.kind && KINDS.has(r.kind) ? r.kind : 'SPEAKER'
    if (!valid.has(r.conferenceId) || !yearOk(r.year) || !httpsUrl(r.sourceUrl) || !plainName(r.name, 60)) continue
    const key = `${r.conferenceId}|${r.name.trim().toLowerCase()}|${kind}`
    if (seen.has(key)) continue
    const n = per.get(r.conferenceId) ?? 0
    if (n >= MAX_PEOPLE) continue
    seen.add(key)
    per.set(r.conferenceId, n + 1)
    out.push({ ...r, kind, name: r.name.trim() })
  }
  return out
}
