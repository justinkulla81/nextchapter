import { prisma } from '@/lib/prisma'

export interface LayoffSignal {
  /** The most recent notice's date, or when it was fetched if it has none. */
  date: Date
  /** Sum of affected employees across the window's notices, when filed. */
  employees: number | null
  notices: number
}

/** How far back a layoff still counts as "affected" for outreach. */
export const LAYOFF_WINDOW_MONTHS = 18

/**
 * Recent WARN notices (and manually entered announcements) for a set of CRM
 * organizations, keyed by org id. Matched the two ways a notice can point at
 * an employer: the Company record it was linked to, or the same
 * normalizeOrgName key the CRM uses for organizations — so an org with no
 * Company link is still found by name.
 */
export async function layoffSignalsFor(
  orgs: { id: string; canonicalNameNormalized: string; companyId: string | null }[],
): Promise<Map<string, LayoffSignal>> {
  const out = new Map<string, LayoffSignal>()
  const real = orgs.filter((o) => !o.canonicalNameNormalized.startsWith('-'))
  if (real.length === 0) return out

  const since = new Date()
  since.setMonth(since.getMonth() - LAYOFF_WINDOW_MONTHS)
  const keys = [...new Set(real.map((o) => o.canonicalNameNormalized))]
  const companyIds = [...new Set(real.map((o) => o.companyId).filter((v): v is string => !!v))]
  const notices = await prisma.warnNotice.findMany({
    where: {
      OR: [{ normalizedEmployer: { in: keys } }, ...(companyIds.length ? [{ companyId: { in: companyIds } }] : [])],
      AND: [{ OR: [{ noticeDate: { gte: since } }, { noticeDate: null, fetchedAt: { gte: since } }] }],
    },
    select: { normalizedEmployer: true, companyId: true, noticeDate: true, fetchedAt: true, employees: true },
  })

  for (const org of real) {
    const mine = notices.filter((n) =>
      n.normalizedEmployer === org.canonicalNameNormalized || (org.companyId && n.companyId === org.companyId))
    if (mine.length === 0) continue
    const dates = mine.map((n) => n.noticeDate ?? n.fetchedAt)
    const counted = mine.filter((n) => n.employees != null)
    out.set(org.id, {
      date: new Date(Math.max(...dates.map((d) => d.getTime()))),
      employees: counted.length ? counted.reduce((sum, n) => sum + (n.employees ?? 0), 0) : null,
      notices: mine.length,
    })
  }
  return out
}
