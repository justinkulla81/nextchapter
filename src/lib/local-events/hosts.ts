import 'server-only'
import { prisma } from '@/lib/prisma'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'
import { getStateData } from '@/lib/seo/org-pages'
import { orgPagePath, type OrgPageKind } from '@/lib/seo/org-page-rules'
import { employerSlug } from '@/lib/seo/employer-slug'
import { collegePath } from '@/lib/seo/college-bar'
import { getStateCollegeListings } from '@/lib/seo/college-pages'
import type { LocalEventRow } from './queries'

export const hostKey = (h: { kind: string; id: string }) => `${h.kind}:${h.id}`
const ORG_KIND: Record<string, OrgPageKind> = { JOB_CENTER: 'JOB_CENTER', WORKFORCE_BOARD: 'WORKFORCE_BOARD', ECON_DEV: 'ECON_DEV' }

/** Page links for the hosts, partners and companies of a list of events: job-center / board / economic-development pages, employer pages, college pages. Chambers, SCORE and the like have no page and stay plain text. */
export async function hostLinkMap(rows: LocalEventRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const states = new Set<string>()
    const companies = new Set<string>()
    for (const e of rows) for (const h of e.hosts) {
      if (ORG_KIND[h.kind] && e.state && ALL_STATE_CODES.includes(e.state)) states.add(e.state)
      if (h.kind === 'COMPANY') companies.add(h.id)
    }
    for (const st of states) {
      const sd = await getStateData(st)
      const lists: [OrgPageKind, typeof sd.centers][] = [['JOB_CENTER', sd.centers], ['WORKFORCE_BOARD', sd.boards], ['ECON_DEV', sd.econDev]]
      for (const [kind, list] of lists) for (const r of list) for (const id of [r.id, ...(r.aliasIds ?? [])]) out.set(`${kind}:${id}`, orgPagePath(kind, stateSlug(st), r.slug))
    }
    if (companies.size) {
      const cs = await prisma.company.findMany({ where: { id: { in: [...companies] } }, select: { id: true, canonicalNameNormalized: true } })
      for (const c of cs) out.set(`COMPANY:${c.id}`, `/employers/${employerSlug(c.canonicalNameNormalized, c.id)}`)
    }
    const colleges = new Map<string, Set<string>>()
    for (const e of rows) for (const h of e.hosts) if (h.kind === 'COLLEGE' && e.state) (colleges.get(e.state) ?? colleges.set(e.state, new Set()).get(e.state)!).add(h.id)
    for (const [st, ids] of colleges) {
      if (!ALL_STATE_CODES.includes(st)) continue
      for (const c of await getStateCollegeListings(st)) if (ids.has(c.unitid) && c.indexable) out.set(`COLLEGE:${c.unitid}`, collegePath(stateSlug(st), c.slug))
    }
  } catch {
    // Links are a nicety: without them the host names show as text.
  }
  return out
}
