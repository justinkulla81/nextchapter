import 'server-only'
import { prisma } from '@/lib/prisma'
import { buildCorpus, resolveMemberPivot, type MemberForPivot, type MemberPivotResult, type OccupationCorpus } from './corpus'

// Reads the O*NET and BLS tables into an OccupationCorpus and keeps it in memory for a
// while. The in-scope occupations carry a few tens of thousands of element rows, too
// large for Next's data cache (about 2 MB an entry), so this is a per-instance cache:
// each server instance loads once, then again after the TTL. Nothing here is per-member.

const TTL_MS = 12 * 60 * 60 * 1000

let cached: { at: number; corpus: OccupationCorpus } | null = null
let inFlight: Promise<OccupationCorpus> | null = null

async function readCorpus(): Promise<OccupationCorpus> {
  const [occupations, altTitles, wages, projections, related] = await Promise.all([
    prisma.onetOccupation.findMany({
      where: { isTarget: true },
      select: {
        onetSocCode: true,
        socCode: true,
        title: true,
        jobZone: true,
        isTarget: true,
        elements: { select: { kind: true, elementId: true, elementName: true, importance: true, level: true } },
        techSkills: { select: { example: true, commodity: true, hotTechnology: true } },
      },
    }),
    prisma.onetAlternateTitle.findMany({
      where: { occupation: { isTarget: true } },
      select: { onetSocCode: true, title: true },
    }),
    prisma.occupationWage.findMany({
      where: { areaType: 'NATIONAL' },
      select: { socCode: true, year: true, wageMedian: true, topCoded: true },
    }),
    prisma.occupationProjection.findMany({ select: { socCode: true, changePct: true, annualOpenings: true } }),
    prisma.onetRelatedOccupation.findMany({
      where: { occupation: { isTarget: true } },
      select: { onetSocCode: true, relatedOnetSocCode: true },
    }),
  ])
  return buildCorpus({ occupations, altTitles, wages, projections, related })
}

async function getCorpus(): Promise<OccupationCorpus> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.corpus
  // A failed read is not cached, so the next request tries again.
  inFlight ??= readCorpus().finally(() => {
    inFlight = null
  })
  const corpus = await inFlight
  // An empty result means the data has not been imported yet; don't hold on to it.
  if (corpus.profiles.length > 0) cached = { at: Date.now(), corpus }
  return corpus
}

/** The member's pivot paths. Throws if the database can't be read; the caller decides how to show that. */
export async function loadMemberPivot(member: MemberForPivot): Promise<MemberPivotResult> {
  return resolveMemberPivot(await getCorpus(), member)
}
