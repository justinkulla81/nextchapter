import 'server-only'
import { prisma } from '@/lib/prisma'
import { COMPETITOR_COMPARISONS } from './competitor-comparisons'
import { buildAlternativePage, isCitable, slugFor, type AlternativePage, type CitedCell } from './alternative-core'

const STATIC_SLUGS = new Set<string>(COMPETITOR_COMPARISONS.map((c) => c.slug))

/** Competitors that are rivals or near rivals. Suppliers, partners-only tools and non-competitors get no page. */
const PAGE_RELATIONSHIPS = ['DIRECT', 'ADJACENT', 'PARTNER']

async function loadAll(): Promise<AlternativePage[]> {
  try {
    const rows = await prisma.productCompetitor.findMany({
      where: { relationship: { in: PAGE_RELATIONSHIPS }, status: { in: ['ACTIVE', 'ACQUIRED'] }, capabilityCells: { some: { status: { in: ['YES', 'PARTIAL', 'NO'] } } } },
      select: {
        name: true, url: true, segment: true, areas: true, relationship: true, status: true,
        capabilityCells: { where: { status: { in: ['YES', 'PARTIAL', 'NO'] }, evidenceUrl: { not: null }, checkedAt: { not: null } }, select: { status: true, note: true, evidenceUrl: true, checkedAt: true, capability: { select: { key: true } } } },
      },
      orderBy: { name: 'asc' },
    })
    const seen = new Set<string>()
    const pages: AlternativePage[] = []
    for (const r of rows) {
      const slug = slugFor(r.name)
      if (!slug || STATIC_SLUGS.has(slug) || seen.has(slug)) continue
      const cells: CitedCell[] = r.capabilityCells
        .filter((c) => isCitable(c))
        .map((c) => ({ capabilityKey: c.capability.key, status: c.status as CitedCell['status'], note: c.note, evidenceUrl: c.evidenceUrl as string, checkedAt: c.checkedAt as Date }))
      const page = buildAlternativePage({ name: r.name, url: r.url, segment: r.segment, areas: r.areas, relationship: r.relationship, status: r.status }, cells)
      if (!page) continue
      seen.add(slug)
      pages.push(page)
    }
    return pages
  } catch {
    // Fail soft: a database problem makes these pages 404 rather than failing a build or a request for another page.
    return []
  }
}

export async function getAlternative(slug: string): Promise<AlternativePage | null> {
  return (await loadAll()).find((p) => p.slug === slug) ?? null
}

/** Pages worth putting in the sitemap. */
export async function listIndexableAlternatives(): Promise<AlternativePage[]> {
  return (await loadAll()).filter((p) => p.indexable)
}
