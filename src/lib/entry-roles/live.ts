import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { readBoardFigure } from '@/lib/jobs/stored-board-figures'
import { PAY, PUBLIC, newestJobs, type TitleJob } from '@/lib/seo/job-titles'
import { computeTitlePlaces, parsePlace, PLACE_MIN_SHOWN, placeIndex, type PlaceIndexRow, type TitlePlace } from '@/lib/seo/job-title-places'
import { stateName, stateSlug } from '@/lib/seo/states'
import { STATE_NAMES } from '@/lib/workforce/places'
import { ENTRY_PLACE_BARS, ENTRY_ROLES, ROLE_HEAD_REGEX_PG, rolesForTitle } from '@/lib/entry-roles/roles'

// Live openings for the entry-level role pages. One pass over the open board reads only the rows whose title names one of the
// roles (a regex over every role's title phrases), keeps the entry-level ones (level entry or early, no level stated, or the posting
// says no experience is needed), and sorts them into roles and places. It runs in the board-figures cron
// (lib/jobs/refresh-board-figures.ts), which stores the results; a page reads a stored row and never scans.

interface Row { id: string; title: string; state: string | null; city: string | null; company: string; posted: Date; pay: number | null; noexp: boolean; training: boolean }

async function scanRows(): Promise<Row[]> {
  // Stage 1: ids and titles of open entry-level-or-unleveled postings whose title has a role's head word (a short regex), cheap enough
  // for the database's 2-minute statement limit. Stage 2 (below) reads the details of the titles that really match a role.
  const candidates = await prisma.$queryRaw<{ id: string; title: string }[]>`
    SELECT id, title FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC}
      AND title ~* ${ROLE_HEAD_REGEX_PG}
      AND (level IS NULL OR level IN ('ENTRY_IC', 'EARLY_IC') OR 'no_experience_ok' = ANY("postingSignals"))`
  const ids = candidates.filter((c) => rolesForTitle(c.title).length > 0).map((c) => c.id)
  const rows: Row[] = []
  for (let i = 0; i < ids.length; i += 4000) {
    const part = await prisma.$queryRaw<(Omit<Row, 'posted' | 'pay'> & { posted: Date; pay: number | null })[]>`
      SELECT id, title, "locationState" AS state, "locationCity" AS city, "companyName" AS company, COALESCE("postedAt", "createdAt") AS posted, ${PAY}::float8 AS pay,
        ('no_experience_ok' = ANY("postingSignals")) AS noexp, ('training_provided' = ANY("postingSignals")) AS training
      FROM "ExclusiveJobPosting" WHERE id = ANY(${ids.slice(i, i + 4000)}::text[])`
    rows.push(...part.map((r) => ({ ...r, posted: new Date(r.posted), pay: r.pay == null ? null : Number(r.pay) })))
  }
  return rows
}

export interface EntryRoleStat {
  slug: string
  jobs: number
  /** Openings whose own text says no experience is needed (the posting's words, not our guess). */
  noExperience: number
  /** Openings whose text says paid training is provided. */
  training: number
  employers: number
  payCount: number
  p25: number | null
  median: number | null
  p75: number | null
}
export interface EntryRoleDetail extends EntryRoleStat {
  jobIds: string[]
  states: { code: string; jobs: number }[]
  topEmployers: { name: string; jobs: number }[]
}

const round500 = (n: number) => Math.round(n / 500) * 500
function pct(sorted: number[], q: number): number | null {
  if (!sorted.length) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return round500(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo))
}
/** Pay is shown only with this many stated annual figures behind it. */
export const ENTRY_MIN_PAY = 8

/** Everything the role pages read, from one scan. Run by the cron, never by a page. */
export async function buildEntryFigures() {
  const rows = await scanRows()
  const byRole = new Map<string, Row[]>()
  for (const r of rows) for (const slug of rolesForTitle(r.title)) (byRole.get(slug) ?? byRole.set(slug, []).get(slug)!).push(r)

  const details: EntryRoleDetail[] = []
  for (const role of ENTRY_ROLES) {
    const list = byRole.get(role.slug) ?? []
    const pay = list.flatMap((r) => (r.pay == null ? [] : [r.pay])).sort((a, b) => a - b)
    const enough = pay.length >= ENTRY_MIN_PAY
    const states = new Map<string, number>()
    const employers = new Map<string, number>()
    for (const r of list) {
      employers.set(r.company, (employers.get(r.company) ?? 0) + 1)
      if (r.state && r.state in STATE_NAMES) states.set(r.state, (states.get(r.state) ?? 0) + 1)
    }
    details.push({
      slug: role.slug,
      jobs: list.length,
      noExperience: list.filter((r) => r.noexp).length,
      training: list.filter((r) => r.training).length,
      employers: employers.size,
      payCount: pay.length,
      p25: enough ? pct(pay, 0.25) : null,
      median: enough ? pct(pay, 0.5) : null,
      p75: enough ? pct(pay, 0.75) : null,
      jobIds: [...list].sort((a, b) => b.posted.getTime() - a.posted.getTime()).slice(0, 40).map((r) => r.id),
      states: [...states].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, jobs]) => ({ code, jobs })),
      topEmployers: [...employers].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([name, jobs]) => ({ name, jobs })),
    })
  }
  const places = computeTitlePlaces(
    ENTRY_ROLES.map((role) => ({
      slug: role.slug,
      name: role.name,
      rows: (byRole.get(role.slug) ?? []).map((r) => ({ id: r.id, state: r.state, city: r.city, company: r.company, posted: r.posted.getTime(), pay: r.pay })),
    })),
    ENTRY_PLACE_BARS,
  )
  return { details, places, index: placeIndex(places) }
}

// ── Readers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const cachedStats = unstable_cache(
  async () => ((await readBoardFigure<EntryRoleStat[]>('entry-role-stats')) ?? []),
  ['entry-role-stats-v1'],
  { revalidate: 600 },
)
const cachedPlaceIndex = unstable_cache(
  async () => ((await readBoardFigure<PlaceIndexRow[]>('entry-role-places-index')) ?? []),
  ['entry-role-places-index-v1'],
  { revalidate: 600 },
)

/** Counts for every role (empty until the cron has run; pages then explain the job and say openings are being counted). */
export const getEntryStats = () => cachedStats()
/** Every (role, place) pair with a page. */
export const getEntryPlaceIndex = () => cachedPlaceIndex()

export interface EntryRoleLive { detail: EntryRoleDetail; jobs: TitleJob[]; states: { code: string; name: string; slug: string; jobs: number }[] }

export async function getEntryRoleLive(slug: string): Promise<EntryRoleLive | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null
  const detail = await readBoardFigure<EntryRoleDetail>(`entry-role:${slug}`)
  if (!detail || detail.jobs === 0) return null
  const jobs = await newestJobs(detail.jobIds, 15)
  return { detail, jobs, states: detail.states.map((s) => ({ code: s.code, name: stateName(s.code), slug: stateSlug(s.code), jobs: s.jobs })) }
}

export interface EntryPlaceLive { place: TitlePlace; jobs: TitleJob[] }

/** One role in one place, or null when the pair has no page or its listings have mostly gone. */
export async function getEntryPlaceLive(slug: string, placeSlug: string): Promise<EntryPlaceLive | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug) || !parsePlace(placeSlug)) return null
  const place = await readBoardFigure<TitlePlace>(`entry-role-place:${slug}:${placeSlug}`)
  if (!place) return null
  const jobs = await newestJobs(place.jobIds, 15)
  return jobs.length >= PLACE_MIN_SHOWN ? { place, jobs } : null
}
