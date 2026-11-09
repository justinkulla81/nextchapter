import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { canonicalFromEmployerSlug, employerSlug, idSuffixFromSlug } from '@/lib/seo/employer-slug'

export interface KnownEmployer { id: string; name: string; slug: string }

/**
 * An employer we hold a Company row for, found from its public slug (the same slug scheme as /employers/<slug> and the layoff pages).
 * One indexed lookup of one row, so it is safe on a request path; null for a word that is not an employer we know. The row must
 * round-trip to the same slug, so a guess never lands on the wrong company.
 */
export const getKnownEmployer = cache(async (slug: string): Promise<KnownEmployer | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 80) return null
  const select = { id: true, name: true, canonicalNameNormalized: true } as const
  let c = await prisma.company.findUnique({ where: { canonicalNameNormalized: canonicalFromEmployerSlug(slug) }, select })
  const suffix = idSuffixFromSlug(slug)
  if (!c && suffix) {
    const candidate = await prisma.company.findFirst({ where: { id: { endsWith: suffix } }, select })
    if (candidate && employerSlug(candidate.canonicalNameNormalized, candidate.id) === slug) c = candidate
  }
  if (!c || employerSlug(c.canonicalNameNormalized, c.id) !== slug) return null
  return { id: c.id, name: c.name, slug }
})
