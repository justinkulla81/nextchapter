import type { InstitutionOrgType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Find the real organization a workforce demo is for (owner decision, 2026-11-17): the demo page searches the workforce
// boards (CareerOneStop) and the economic-development bodies (LocalPartnerOrg) already on file, and builds the demo from
// that record, so nobody types the organization in. Typing it in stays as the fallback when it is not on file.
//
// Data: WorkforceBoard ~560 rows, LocalPartnerOrg ~2,400 (2026-11-17). A search reads at most 8 + 8 narrow rows
// (~200 B each) plus, for an admin, up to 10 demo rows; a typed search fires after a pause, so well under 0.01 GB a day.

export type DemoOrgKind = 'WORKFORCE_BOARD' | 'ECON_DEV'
type DemoOrgType = Exclude<InstitutionOrgType, 'COLLEGE'>

export interface DemoOrg {
  kind: DemoOrgKind
  id: string
  /** The name the organization goes by (a board's "known as" name when it has one). */
  name: string
  /** The official name, when it differs from `name`. */
  officialName: string | null
  orgType: DemoOrgType
  typeLabel: string
  city: string | null
  state: string
}

/** A demo already built, shown to NextChapter admins so they open it instead of making another. */
export interface ExistingDemo {
  slug: string
  name: string
  createdAt: string | null
  /** The demo was made from this directory record (not only a name match). */
  sourceKey: string | null
}

const PARTNER_KINDS = ['EDD', 'LOCAL_EDO', 'STATE_AGENCY'] as const
const PARTNER_LABEL: Record<string, string> = { EDD: 'Economic development district', LOCAL_EDO: 'Economic development', STATE_AGENCY: 'State economic development agency' }

/** "410 W Chestnut Street, Suite 200, Louisville, KY 40202" → "Louisville". */
export function cityFromAddress(address: string | null | undefined): string | null {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]
  // The last part is "KY 40202" (state and zip) or just the state; the city is the part before it.
  if (!/^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(last)) return null
  const city = parts[parts.length - 2]
  return /\d/.test(city) ? null : city
}

export const sourceKey = (kind: DemoOrgKind, id: string) => `${kind}:${id}`

function cleanQuery(q: string): string | null {
  const t = q.trim().replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
  return t.length >= 2 ? t : null
}

export async function searchDemoOrgs(q: string, state?: string | null): Promise<DemoOrg[]> {
  const term = cleanQuery(q)
  if (!term) return []
  const st = state && /^[A-Z]{2}$/.test(state) ? state : undefined
  const like = { contains: term, mode: 'insensitive' as const }
  const [boards, partners] = await Promise.all([
    prisma.workforceBoard.findMany({
      where: { ...(st ? { state: st } : {}), OR: [{ name: like }, { knownAs: like }] },
      select: { id: true, name: true, knownAs: true, state: true, address: true },
      orderBy: { name: 'asc' },
      take: 8,
    }),
    prisma.localPartnerOrg.findMany({
      where: { kind: { in: [...PARTNER_KINDS] }, ...(st ? { state: st } : {}), OR: [{ name: like }, { abbrev: like }] },
      select: { id: true, kind: true, name: true, abbrev: true, state: true, city: true },
      orderBy: { name: 'asc' },
      take: 8,
    }),
  ])
  return [
    ...boards.map((b) => ({
      kind: 'WORKFORCE_BOARD' as const,
      id: b.id,
      name: b.knownAs?.trim() || b.name,
      officialName: b.knownAs?.trim() ? b.name : null,
      orgType: 'WORKFORCE_BOARD' as const,
      typeLabel: 'Workforce board',
      city: cityFromAddress(b.address),
      state: b.state,
    })),
    ...partners.map((p) => ({
      kind: 'ECON_DEV' as const,
      id: p.id,
      name: p.name,
      officialName: null,
      orgType: 'ECONOMIC_DEVELOPMENT' as const,
      typeLabel: PARTNER_LABEL[p.kind] ?? 'Economic development',
      city: p.city?.trim() || null,
      state: p.state,
    })),
  ]
}

/** One directory record, re-read on the server when a demo is built from it (the browser only sends kind and id). */
export async function demoOrgById(kind: DemoOrgKind, id: string): Promise<DemoOrg | null> {
  if (kind === 'WORKFORCE_BOARD') {
    const b = await prisma.workforceBoard.findUnique({ where: { id }, select: { id: true, name: true, knownAs: true, state: true, address: true } })
    if (!b) return null
    return { kind, id: b.id, name: b.knownAs?.trim() || b.name, officialName: b.knownAs?.trim() ? b.name : null, orgType: 'WORKFORCE_BOARD', typeLabel: 'Workforce board', city: cityFromAddress(b.address), state: b.state }
  }
  const p = await prisma.localPartnerOrg.findUnique({ where: { id }, select: { id: true, kind: true, name: true, state: true, city: true } })
  if (!p || !(PARTNER_KINDS as readonly string[]).includes(p.kind)) return null
  return { kind, id: p.id, name: p.name, officialName: null, orgType: 'ECONOMIC_DEVELOPMENT', typeLabel: PARTNER_LABEL[p.kind] ?? 'Economic development', city: p.city?.trim() || null, state: p.state }
}

/** The organization's own brand color, when its site was scanned (OrgBrand). */
export async function demoOrgColor(kind: DemoOrgKind, id: string): Promise<string | null> {
  const b = await prisma.orgBrand.findUnique({ where: { kind_sourceId: { kind, sourceId: id } }, select: { primary: true } }).catch(() => null)
  return b?.primary && /^#[0-9a-fA-F]{6}$/.test(b.primary) ? b.primary : null
}

/**
 * Demos already built for these organizations: by the directory record they were made from, or (for demos made before
 * that was recorded) by the same name. Admin only: other visitors never see anyone's demo.
 */
export async function existingDemosFor(orgs: Pick<DemoOrg, 'kind' | 'id' | 'name'>[]): Promise<Record<string, ExistingDemo[]>> {
  if (orgs.length === 0) return {}
  const keys = orgs.map((o) => sourceKey(o.kind, o.id))
  const names = [...new Set(orgs.map((o) => o.name))]
  const rows = await prisma.institution.findMany({
    where: {
      isDemo: true,
      orgType: { not: 'COLLEGE' },
      OR: [...keys.map((k) => ({ enabledFeatures: { path: ['demo', 'sourceOrg'], equals: k } })), { name: { in: names, mode: 'insensitive' as const } }],
    },
    select: { slug: true, name: true, enabledFeatures: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const out: Record<string, ExistingDemo[]> = {}
  for (const o of orgs) {
    const key = sourceKey(o.kind, o.id)
    out[key] = rows
      .map((r) => {
        const demo = (r.enabledFeatures as { demo?: { sourceOrg?: string; createdAt?: string; expiresAt?: string | null } } | null)?.demo
        return { r, demo }
      })
      .filter(({ r, demo }) => (demo?.sourceOrg ? demo.sourceOrg === key : r.name.toLowerCase() === o.name.toLowerCase()))
      .filter(({ demo }) => !demo?.expiresAt || new Date(demo.expiresAt) > new Date())
      .map(({ r, demo }) => ({ slug: r.slug, name: r.name, createdAt: demo?.createdAt ?? null, sourceKey: demo?.sourceOrg ?? null }))
  }
  return out
}
