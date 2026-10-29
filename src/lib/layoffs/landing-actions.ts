'use server'

import { prisma } from '@/lib/prisma'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { areaSlug, getStateCollegeListings } from '@/lib/seo/college-pages'
import { collegePath } from '@/lib/seo/college-bar'

export interface SchoolHit { id: string; name: string; place: string; path: string | null }

/** The college search on a company page: the biggest schools whose name contains what was typed, each with its page on this site. */
export async function searchSchools(q: string): Promise<SchoolHit[]> {
  const term = (q ?? '').trim().slice(0, 60)
  if (term.length < 2) return []
  if (!(await allowByIp('school-search', 120, HOUR_MS))) return []
  const rows = await prisma.collegeProfile.findMany({
    where: { name: { contains: term, mode: 'insensitive' } },
    orderBy: { enrollment: { sort: 'desc', nulls: 'last' } },
    take: 8,
    select: { unitid: true, name: true, city: true, state: true },
  })
  const states = [...new Set(rows.map((r) => r.state).filter((s): s is string => !!s))]
  const slugByUnit = new Map<string, string>()
  await Promise.all(states.map(async (st) => {
    for (const c of await getStateCollegeListings(st).catch(() => [])) slugByUnit.set(c.unitid, c.slug)
  }))
  return rows.map((r) => {
    const slug = slugByUnit.get(r.unitid)
    return {
      id: r.unitid,
      name: r.name,
      place: [r.city, r.state].filter(Boolean).join(', '),
      path: slug && r.state ? collegePath(areaSlug(r.state), slug) : null,
    }
  })
}
