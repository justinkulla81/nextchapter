import 'server-only'
import { cache } from 'react'
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

const byEmployer = cache(() => {
  const m = new Map<string, { id: string; role: string }[]>()
  for (const [id, rows] of Object.entries(FILE)) for (const r of rows) {
    const k = normalizeOrgName(r.name)
    m.set(k, [...(m.get(k) ?? []), { id, role: r.role }])
  }
  return m
})

/** Conferences (ids) where the employer is known to exhibit, sponsor or speak. */
export function conferencesForEmployer(name: string): { id: string; role: string }[] {
  return byEmployer().get(normalizeOrgName(name)) ?? []
}
