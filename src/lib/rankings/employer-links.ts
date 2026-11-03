import 'server-only'
import { prisma } from '@/lib/prisma'
import { employerPath, offeredCompanyIds } from '@/lib/seo/employer-pages'
import { normalizeOrgName } from '@/lib/text/org-name-match'

/**
 * The employer page for each employer name a ranking lists ("Hiring most here: ..."), for the names that have one offered to
 * search engines. A name with no page, or a failed read, is simply left out and shows as plain text.
 */
export async function employerLinks(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const byNorm = new Map<string, string[]>()
    for (const n of new Set(names)) {
      const norm = normalizeOrgName(n)
      if (norm) byNorm.set(norm, [...(byNorm.get(norm) ?? []), n])
    }
    if (!byNorm.size) return out
    const companies = await prisma.company.findMany({ where: { canonicalNameNormalized: { in: [...byNorm.keys()] } }, select: { id: true, canonicalNameNormalized: true } })
    const offered = await offeredCompanyIds(companies.map((c) => c.id))
    for (const c of companies) {
      if (!offered.has(c.id)) continue
      for (const name of byNorm.get(c.canonicalNameNormalized) ?? []) out.set(name, employerPath(c.canonicalNameNormalized, c.id))
    }
  } catch {
    // Links are an extra: the ranking reads the same without them.
  }
  return out
}
