import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchOccupationTitles } from '@/lib/careers/candidate-occupation'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { exposureFor, exposureSentence, soc6Of, type ExposureBand } from '@/lib/skills/ai-exposure'
import { checkPath } from '@/lib/ai-check/slug'
import { lookupEmployers } from '@/lib/layoff-risk/context'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { bestRoleMatch, cleanTitle } from '@/lib/xray/match'

// Everything the job X-ray panel shows for a title and an employer name. Public data only, no model call. The posted pay never
// reaches the server: the extension compares it with the median returned here.

const SITE = 'https://launchyournextchapter.com'

export interface XrayResult {
  occupation: null | { title: string; soc6: string; exposurePercent: number; band: ExposureBand; sentence: string; medianWage: number | null; url: string }
  layoffs: null | { name: string; recentNotices: number; latest: string | null; announcedRecently: boolean; url: string }
  careerSite: null | { title: string; url: string; ncUrl: string }
}

async function occupationFor(title: string): Promise<XrayResult['occupation']> {
  const [found, exposure] = await Promise.all([searchOccupationTitles(title), loadExposureMap()])
  // Only the best match counts, and only when it is a close match: a weak fallback would put the wrong job's numbers on a posting.
  const hit = found[0]
  if (!hit || hit.score < 0.75 || !exposure.has(soc6Of(hit.socCode))) return null
  const e = exposureFor(hit.socCode, exposure)
  if (!e) return null
  const occ = await prisma.occupation.findUnique({ where: { socCode: hit.socCode }, select: { medianWage: true } }).catch(() => null)
  return {
    title: hit.title,
    soc6: e.soc6,
    exposurePercent: Math.round(e.score * 100),
    band: e.band,
    sentence: exposureSentence(e),
    medianWage: occ?.medianWage ?? null,
    url: `${SITE}${checkPath(hit.title, e.soc6)}`,
  }
}

async function layoffsFor(employer: string): Promise<XrayResult['layoffs']> {
  const key = normalizeOrgName(employer)
  const rows = await lookupEmployers(employer, 5)
  // Only an exact normalized-name match counts as "this employer"; a partial hit could be a different company.
  const hit = rows.find((r) => normalizeOrgName(r.name) === key)
  if (!hit || (hit.recentNotices === 0 && !hit.announcedRecently)) return null
  return { name: hit.name, recentNotices: hit.recentNotices, latest: hit.latest, announcedRecently: hit.announcedRecently, url: `${SITE}/layoffs/company/${hit.slug}` }
}

async function careerSiteFor(employer: string, title: string): Promise<XrayResult['careerSite']> {
  const company = await prisma.company.findUnique({ where: { canonicalNameNormalized: normalizeOrgName(employer) }, select: { id: true } }).catch(() => null)
  if (!company) return null
  const rows = await prisma.exclusiveJobPosting
    .findMany({
      where: { companyId: company.id, archivedAt: null, directListing: true, status: 'approved' },
      select: { id: true, title: true, url: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    .catch(() => [])
  const match = bestRoleMatch(title, rows)
  return match ? { title: match.title, url: match.url, ncUrl: `${SITE}/jobs/${match.id}` } : null
}

export async function xrayLookup(rawTitle: string, rawEmployer: string): Promise<XrayResult> {
  const title = cleanTitle(rawTitle)
  const employer = rawEmployer.trim().slice(0, 80)
  const [occupation, layoffs, careerSite] = await Promise.all([
    title.length >= 2 ? occupationFor(title).catch(() => null) : null,
    employer.length >= 2 ? layoffsFor(employer).catch(() => null) : null,
    employer.length >= 2 ? careerSiteFor(employer, title) : null,
  ])
  return { occupation, layoffs, careerSite }
}
