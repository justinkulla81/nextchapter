import 'server-only'
import { prisma } from '@/lib/prisma'
import { lookupCompanyByNormalizedName } from '@/lib/companies/company-lookup'
import { memberMarketRole } from '@/lib/market/adzuna-insights'
import { matchWages, wordsOf, type WageRow } from '@/lib/market/offered-wage-match'

export type MemberOfferedWages = {
  role: string
  across: (WageRow & { score: number })[] // every matching filing summary, best match first
  tracked: (WageRow & { score: number })[] // the same, for companies the member tracks
}

// What employers have filed to pay for occupations like the member's role
// (public DOL filings), across all employers and for the companies they track.
// Null when the member has no role yet.
export async function getOfferedWagesForMember(candidateId: string): Promise<MemberOfferedWages | null> {
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { targetRoleType: true, targetFunction: true, primaryFunction: true },
  })
  const role = p ? memberMarketRole(p) : null
  if (!role) return null

  // Narrow in the database on the role's most specific word, then match carefully.
  const words = wordsOf(role).filter((w) => w.length > 3)
  const rows = words.length
    ? await prisma.offeredWageSummary.findMany({
        where: { OR: words.slice(0, 3).map((w) => ({ socTitle: { contains: w, mode: 'insensitive' as const } })) },
        orderBy: { filings: 'desc' },
        take: 400,
        select: { companyId: true, employerName: true, socTitle: true, filings: true, wageP25: true, wageMedian: true, wageP75: true, topState: true },
      })
    : []
  const across = matchWages(role, rows)

  const watch = await prisma.companyWatchlistEntry.findMany({ where: { candidateId }, select: { companyNameNormalized: true }, take: 50 })
  const ids = new Set<string>()
  for (const w of watch) {
    const c = await lookupCompanyByNormalizedName(w.companyNameNormalized)
    if (c) ids.add(c.id)
  }
  const idByRow = new Map(rows.map((r) => [`${r.employerName}|${r.socTitle}`, r.companyId]))
  const tracked = across.filter((r) => ids.has(idByRow.get(`${r.employerName}|${r.socTitle}`) ?? ''))
  return { role, across, tracked }
}
