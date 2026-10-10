import 'server-only'
import { prisma } from '@/lib/prisma'
import type { LikelyOpeningSignalType } from '@prisma/client'
import { companyKey } from './roles'

export interface CompanyLikelyOpening {
  id: string
  signalType: LikelyOpeningSignalType
  roles: string[]
  summary: string
  filingDate: Date
  filingUrl: string
}

/**
 * Active signals for a set of company names (as candidates typed them),
 * newest first, keyed by the name passed in. Used by the Company Tracker.
 */
export async function getLikelyOpeningsForCompanies(
  companyNames: string[],
  { perCompany = 2 }: { perCompany?: number } = {}
): Promise<Map<string, CompanyLikelyOpening[]>> {
  const keyByName = new Map(companyNames.map((n) => [n, companyKey(n)]))
  const keys = [...new Set([...keyByName.values()].filter(Boolean))]
  const result = new Map<string, CompanyLikelyOpening[]>()
  if (keys.length === 0) return result
  const rows = await prisma.likelyOpening.findMany({
    where: { companyNameNormalized: { in: keys }, expiresAt: { gt: new Date() } },
    orderBy: { filingDate: 'desc' },
    select: { id: true, companyNameNormalized: true, signalType: true, roles: true, summary: true, filingDate: true, filingUrl: true },
  })
  for (const [name, key] of keyByName) {
    const mine = rows.filter((r) => r.companyNameNormalized === key).slice(0, perCompany)
    if (mine.length) result.set(name, mine.map(({ companyNameNormalized: _k, ...r }) => (void _k, r)))
  }
  return result
}
