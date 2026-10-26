import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { EMPLOYER_MIN_OPEN_ROLES } from '@/lib/seo/employer-pages'
import { employerSlug } from '@/lib/seo/employer-slug'
import bundled from './conference-employers.json'

// Employers known to exhibit at, sponsor or speak at a conference, each with the page it was read from.
// Two sources, merged: the bundled file (collected from each event's own sponsor, exhibitor and speaker pages by
// scripts/seo/merge-conference-employers.py) and the ConferenceEmployer table (hand entry). Names are never inferred.

export interface ConferenceEmployerRow { name: string; role: string; year: number | null; sourceUrl: string | null }

const FILE = bundled as Record<string, ConferenceEmployerRow[]>

export async function employersForConference(seriesId: string): Promise<ConferenceEmployerRow[]> {
  const fromDb = await prisma.conferenceEmployer
    .findMany({ where: { seriesId }, select: { name: true, role: true, year: true, sourceUrl: true } })
    .catch(() => [] as ConferenceEmployerRow[])
  const seen = new Set<string>()
  const out: ConferenceEmployerRow[] = []
  for (const r of [...(FILE[seriesId] ?? []), ...fromDb]) {
    const key = `${normalizeOrgName(r.name)}:${r.role}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  const rank: Record<string, number> = { SPONSOR: 0, EXHIBITOR: 1, SPEAKER: 2, ATTENDEE: 3 }
  return out.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name))
}

/** Companies in the list that have an employer page of their own: name -> slug. One query. */
export async function employerPageSlugs(names: string[]): Promise<Map<string, string>> {
  const keys = [...new Set(names.map((n) => normalizeOrgName(n)).filter(Boolean))]
  if (keys.length === 0) return new Map()
  const rows = await prisma.company
    .findMany({ where: { canonicalNameNormalized: { in: keys }, hiringProfile: { is: { openNow: { gte: EMPLOYER_MIN_OPEN_ROLES } } } }, select: { id: true, canonicalNameNormalized: true } })
    .catch(() => [])
  return new Map(rows.map((r) => [r.canonicalNameNormalized, employerSlug(r.canonicalNameNormalized, r.id)]))
}

// Reverse index for employer pages: employer (normalized name) -> conferences where it exhibits, sponsors or speaks. Built from the bundled
// file plus every ConferenceEmployer row and every named speaker's organization in the database; cached for an hour, because the table is small
// (a few thousand rows) and read by many employer pages.
async function loadByEmployer(): Promise<[string, { id: string; role: string }[]][]> {
  const m = new Map<string, { id: string; role: string }[]>()
  const add = (name: string | null, id: string, role: string) => {
    const k = name ? normalizeOrgName(name) : ''
    if (!k) return
    const list = m.get(k) ?? []
    if (!list.some((x) => x.id === id)) list.push({ id, role })
    m.set(k, list)
  }
  for (const [id, rows] of Object.entries(FILE)) for (const r of rows) add(r.name, id, r.role)
  const [emps, spk] = await Promise.all([
    // A failed read throws, so unstable_cache does not store a file-only index for an hour; the caller falls back to the file for that request.
    prisma.conferenceEmployer.findMany({ select: { seriesId: true, name: true, role: true }, take: 20000 }),
    prisma.conferenceSpeaker.findMany({ where: { organization: { not: null } }, select: { seriesId: true, organization: true }, take: 20000 }),
  ])
  for (const r of emps) add(r.name, r.seriesId, r.role)
  for (const r of spk) add(r.organization, r.seriesId, 'SPEAKER')
  return [...m]
}

const cachedByEmployer = unstable_cache(loadByEmployer, ['conference-by-employer-v2'], { revalidate: 3600 })

/** Conferences (ids) where the employer is known to exhibit, sponsor or speak. */
export async function conferencesForEmployer(name: string): Promise<{ id: string; role: string }[]> {
  const key = normalizeOrgName(name)
  try {
    const hit = (await cachedByEmployer()).find(([k]) => k === key)
    return hit?.[1] ?? []
  } catch {
    return Object.entries(FILE).flatMap(([id, rows]) => rows.filter((r) => normalizeOrgName(r.name) === key).slice(0, 1).map((r) => ({ id, role: r.role })))
  }
}
