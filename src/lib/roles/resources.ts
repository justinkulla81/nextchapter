import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RoleDef } from '@/lib/seo/role-pages'
import { getFirmListings } from '@/lib/seo/search-firm-pages'
import { conferencesForFunction, type Conf } from '@/lib/seo/topic-data'
import { getPublicCatalog } from '@/lib/learning/public-catalog'
import { catalogFunctionByName, functionPath as aiCoursesFunctionPath, coursePath, type PublicCourse } from '@/lib/learning/public-catalog-shared'
import { ROLE_SHORT, signalSource, sourceLinkLabel, type SignalSource } from '@/lib/likely-openings/roles'
import { conferencesForRole, firmsForRole, turnoverScope } from './resources-rules'
import { mediaForFunction, type MediaItem } from './media'

// Everything around a role besides its open jobs: the recruiters who recruit for it, the conferences and training for its
// function, the officer changes filed for it, and the media its people follow. Each part fails soft: a part that cannot be
// read is left off the page rather than failing it.

/** `searches`: live public searches in the role's own function and level. */
export interface RoleFirm { orgId: string; slug: string; name: string; searches: number }
export interface RoleTurnover {
  label: string
  ownSeat: boolean
  /** `summary` is the plain sentence the reader wrote from the filing or report; `linkLabel` says which it is. */
  items: { id: string; company: string; role: string; kind: 'left' | 'named'; date: Date; url: string; summary: string; source: SignalSource; linkLabel: string }[]
}
export interface RoleResources {
  firms: RoleFirm[]
  /** Not-yet-started conferences for the role's level; `total` is how many qualified, `upcoming` how many have dates. */
  conferences: { rows: Conf[]; total: number; upcoming: number } | null
  courses: { fnPath: string | null; rows: PublicCourse[]; total: number }
  turnover: RoleTurnover | null
  media: MediaItem[]
}

const TURNOVER_WINDOW_DAYS = 120
const soft = async <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null)

async function loadTurnover(role: RoleDef): Promise<RoleTurnover | null> {
  const scope = turnoverScope(role)
  if (!scope) return null
  const since = new Date(Date.now() - TURNOVER_WINDOW_DAYS * 86_400_000)
  const rows = await prisma.likelyOpening.findMany({
    where: { signalType: { in: ['EXEC_DEPARTURE', 'EXEC_APPOINTMENT'] }, roles: { hasSome: scope.codes }, filingDate: { gte: since } },
    orderBy: { filingDate: 'desc' },
    take: 8,
    select: { id: true, companyName: true, signalType: true, roles: true, filingDate: true, filingUrl: true, summary: true, cik: true },
  })
  if (rows.length === 0) return null
  return {
    label: scope.label,
    ownSeat: scope.ownSeat,
    items: rows.map((r) => ({
      id: r.id,
      company: r.companyName,
      role: ROLE_SHORT[(r.roles.find((c) => scope.codes.includes(c)) ?? scope.codes[0]) as keyof typeof ROLE_SHORT] ?? scope.codes[0],
      kind: r.signalType === 'EXEC_DEPARTURE' ? 'left' : 'named',
      date: r.filingDate,
      url: r.filingUrl,
      summary: r.summary,
      source: signalSource(r.cik),
      linkLabel: sourceLinkLabel(signalSource(r.cik)),
    })),
  }
}

export async function getRoleResources(role: RoleDef): Promise<RoleResources> {
  const [firms, conferences, catalog, turnover] = await Promise.all([
    soft(getFirmListings()),
    soft(conferencesForFunction(role.fn, 120)),
    soft(getPublicCatalog()),
    soft(loadTurnover(role)),
  ])
  const fitting = conferences ? conferencesForRole(role, conferences.rows, new Date(), 120) : []
  const roleConferences = fitting.length > 0 ? { rows: fitting.slice(0, 6), total: fitting.length, upcoming: fitting.filter((c) => c.datesConfirmed && c.startDate).length } : null
  const fn = catalogFunctionByName(role.fn)
  const forFn = (catalog ?? []).filter((c) => c.functions.includes(role.fn))
  return {
    firms: firmsForRole(role, firms ?? []).map((f) => ({ orgId: f.orgId, slug: f.slug, name: f.name, searches: f.searches })),
    conferences: roleConferences,
    courses: { fnPath: fn ? aiCoursesFunctionPath(fn) : null, rows: forFn.slice(0, 6), total: forFn.length },
    turnover,
    media: mediaForFunction(role.fn),
  }
}

export { coursePath }
