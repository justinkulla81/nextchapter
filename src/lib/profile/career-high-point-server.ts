import 'server-only'
import type { CompanySizeBand, Prisma, WorkHistoryEntry } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { candidateScaleLevel, classifyTitleRung } from '@/lib/jobs/job-seniority'
import { resolveContextualLevel } from '@/lib/scoring/seniority/resolve-contextual-level'
import { loadBoardCompanySizes } from '@/lib/market/company-size'
import { STARTUP_SOURCE_CATEGORIES } from '@/lib/jobs/level-flex'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { deriveCareerHighPoint, type CareerHighPoint, type HighPointEntry } from '@/lib/profile/career-high-point'

// Derives a member's career high point (career-high-point.ts) from their work history.
// Company size comes from the curated static list, the permanent CompanySizeLookup cache
// and Company.sizeBand only — never an LLM call; an employer of unknown size stays unknown.
// A startup is an employer an admin marked VC-backed, or one with jobs on a startup board
// (VC / PE portfolio, YC / accelerator, startup sources), unless its size is 5,000+.

const LARGE: CompanySizeBand[] = ['LARGE', 'ENTERPRISE', 'MEGA']

// C-Suite on the member scale takes a top-job word. The job rules rank every Executive
// Director and General Manager as C_SUITE and every SVP / EVP as executive; on a resume
// those are VP-level roles ("Executive Director, Leadership Development" at Verizon).
const TOP_JOB = /\b(chief|c[eoft]o|president|founder|co-?founder|owner|managing partner|partner|chair(man|woman|person)?|head of school|superintendent|executive director)\b/i
const CORPORATE_ED = /\bexecutive director\b\s*[,:\-–]/i

function memberScaleLevel(title: string): string | null {
  const { rung } = classifyTitleRung(title)
  const level = candidateScaleLevel(rung)
  if (level !== 'C-Suite') return level
  if (rung === 'EVP_SVP') return 'VP'
  // "Executive Director, <function>" is a corporate grade; a bare "Executive Director" runs the organization.
  if (!TOP_JOB.test(title.replace(/(?<!vice[ -])president/i, 'president')) || CORPORATE_ED.test(title)) return 'VP'
  if (/\bvice[ -]president\b/i.test(title) && !/\b(chief|ceo|founder|owner)\b/i.test(title)) return 'VP'
  return level
}

type Profile = { id: string; highestLevelReached: string | null; searchExpansion: unknown }

export async function computeDerivedCareerHighPoint(
  candidate: Profile,
  workHistory: Pick<WorkHistoryEntry, 'id' | 'companyName' | 'companyIndustry' | 'roleTitle' | 'startDate' | 'endDate' | 'engagementType'>[],
  now = new Date()
): Promise<CareerHighPoint | null> {
  const entries = workHistory.filter((e) => e.engagementType !== 'INTERNSHIP' && e.roleTitle?.trim() && e.companyName?.trim())
  if (entries.length === 0) return null
  const sizes = await loadBoardCompanySizes()
  const names = [...new Set(entries.map((e) => normalizeOrgName(e.companyName)).filter(Boolean))]
  const companies = names.length
    ? await prisma.company.findMany({
        where: { canonicalNameNormalized: { in: names } },
        select: {
          canonicalNameNormalized: true,
          ownershipType: true,
          postings: { where: { sourceCategory: { in: [...STARTUP_SOURCE_CATEGORIES] } }, select: { id: true }, take: 1 },
        },
      })
    : []
  const startupNames = new Set(
    companies.filter((c) => c.ownershipType === 'VC_BACKED' || c.postings.length > 0).map((c) => c.canonicalNameNormalized)
  )
  const points: HighPointEntry[] = entries.map((e) => {
    const norm = normalizeOrgName(e.companyName)
    const sizeBand = sizes.get(norm) ?? null
    const contextual = resolveContextualLevel({
      title: e.roleTitle,
      companyName: e.companyName,
      freeformIndustry: e.companyIndustry,
      tenureMonthsInRole: null,
      yearsIntoCareerAtStart: null,
      companySizeBand: sizeBand,
      concurrentRoles: [],
    })
    // The title's own level: the industry ladders (finance, law) first, then the job
    // seniority rules (classifyTitleRung, which reads "Partnerships" and "Talent Partner"
    // as the staff titles they are), then the keyword fallback.
    const level = contextual?.level ?? memberScaleLevel(e.roleTitle) ?? inferLevelFromTitle(e.roleTitle)
    return {
      level,
      companyName: e.companyName,
      title: e.roleTitle,
      startDate: e.startDate,
      sizeBand,
      startup: startupNames.has(norm) && !(sizeBand && LARGE.includes(sizeBand)),
    }
  })
  return deriveCareerHighPoint(points, now)
}

/** The member's searchExpansion JSON with a freshly derived career high point (nothing written). */
export async function withDerivedCareerHighPoint(
  candidate: Profile,
  workHistory: Parameters<typeof computeDerivedCareerHighPoint>[1]
): Promise<Record<string, unknown>> {
  const raw = (candidate.searchExpansion && typeof candidate.searchExpansion === 'object' ? candidate.searchExpansion : {}) as Record<string, unknown>
  const store = readSearchExpansion(raw).careerHighPoint ?? {}
  const derived = await computeDerivedCareerHighPoint(candidate, workHistory)
  const next = { ...store, ...(derived ? { derived } : {}) }
  if (!derived) delete (next as { derived?: unknown }).derived
  return { ...raw, careerHighPoint: next }
}

/** Re-derive and save the member's career high point (their own correction is kept). Fail-soft. */
export async function refreshDerivedCareerHighPoint(candidateId: string): Promise<void> {
  try {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { id: true, highestLevelReached: true, searchExpansion: true, workHistory: true },
    })
    if (!candidate) return
    const searchExpansion = await withDerivedCareerHighPoint(candidate, candidate.workHistory)
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { searchExpansion: searchExpansion as Prisma.InputJsonValue },
    })
  } catch (error) {
    console.error('Career high point not refreshed for', candidateId, error)
  }
}
