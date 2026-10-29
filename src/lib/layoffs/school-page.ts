import 'server-only'
import { prisma } from '@/lib/prisma'
import { areaSlug, getStateCollegeListings } from '@/lib/seo/college-pages'
import { collegePath } from '@/lib/seo/college-bar'

/** The path of a college's page on this site from its College Scorecard unitid, or null when it has none. */
export async function schoolPagePath(unitid: string): Promise<string | null> {
  try {
    const row = await prisma.collegeProfile.findUnique({ where: { unitid }, select: { state: true } })
    if (!row?.state) return null
    const listing = (await getStateCollegeListings(row.state)).find((c) => c.unitid === unitid)
    return listing ? collegePath(areaSlug(row.state), listing.slug) : null
  } catch {
    return null
  }
}
