import 'server-only'
import { prisma } from '@/lib/prisma'
import { aggregateCulture, type CultureProfile } from '@/lib/companies/culture-aggregate'
import { CULTURE_KEYS, type CultureAnswers, type CultureDimensionKey } from '@/lib/companies/culture-survey'

// Reads and writes for the insider culture survey. The ONLY place CompanyCultureResponse
// is read for display — always through aggregateCulture (privacy floor, viewer dropped).
// Computed on read rather than stored: the table is small (one row per member per
// employer), it is read by companyId through the unique index, and computing on read
// means a member who later turns on Confidential Search Mode or STEALTH drops out of
// every aggregate immediately instead of waiting for a recompute.
//
// Who is asked: members who worked at the company (MemberEmployment, or a resume /
// undated job already matched to the Company). Not asked, and never counted: members
// in Confidential Search Mode or on the STEALTH tier (the insider network and the
// ex-employee feedback request exclude the same people), system and sample accounts.

const EXCLUDED_CANDIDATE = { select: { confidentialSearchMode: true, privacyTier: true, isSystemAccount: true, isSampleData: true } } as const

type PrivacyFields = { confidentialSearchMode: boolean; privacyTier: string; isSystemAccount: boolean; isSampleData: boolean }
export const isCultureExcluded = (c: PrivacyFields) => c.confidentialSearchMode || c.privacyTier === 'STEALTH' || c.isSystemAccount || c.isSampleData

const answersOf = (r: Partial<Record<CultureDimensionKey, number | null>>): CultureAnswers =>
  Object.fromEntries(CULTURE_KEYS.map((k) => [k, r[k] ?? null]))

/** Culture profiles for several companies at once (job board), from the viewer's point of view. */
export async function getCultureProfiles(companyIds: string[], viewerCandidateId: string | null): Promise<Map<string, CultureProfile>> {
  const ids = [...new Set(companyIds)]
  const out = new Map<string, CultureProfile>()
  if (ids.length === 0) return out
  const rows = await prisma.companyCultureResponse.findMany({
    where: { companyId: { in: ids } },
    select: { companyId: true, candidateId: true, ...Object.fromEntries(CULTURE_KEYS.map((k) => [k, true])), candidate: EXCLUDED_CANDIDATE },
  })
  const grouped = new Map<string, typeof rows>()
  for (const r of rows) grouped.set(r.companyId, [...(grouped.get(r.companyId) ?? []), r])
  for (const id of ids) {
    const group = grouped.get(id) ?? []
    out.set(
      id,
      aggregateCulture(
        id,
        group.map((r) => ({ candidateId: r.candidateId, answers: answersOf(r as never), excluded: isCultureExcluded(r.candidate) })),
        viewerCandidateId
      )
    )
  }
  return out
}

export async function getCultureProfile(companyId: string, viewerCandidateId: string | null): Promise<CultureProfile> {
  return (await getCultureProfiles([companyId], viewerCandidateId)).get(companyId)!
}

// ── Who can answer for which company ─────────────────────────────────────────

export interface CultureSurveyCompany {
  companyId: string
  companyName: string
  slug: string
  isCurrent: boolean
  tenureEndedAt: Date | null
  /** The member's saved answers, when they have answered. */
  answers: CultureAnswers | null
}

/** Every company this member worked at that they could describe. Empty when the member is privacy-excluded. */
export async function getCultureSurveyCompanies(candidateId: string): Promise<CultureSurveyCompany[]> {
  const me = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, ...EXCLUDED_CANDIDATE })
  if (!me || isCultureExcluded(me)) return []

  const [employment, work, undated, responses] = await Promise.all([
    prisma.memberEmployment.findMany({ where: { candidateId }, select: { companyId: true, isCurrent: true, endDate: true } }),
    prisma.workHistoryEntry.findMany({ where: { candidateId, companyId: { not: null } }, select: { companyId: true, isCurrent: true, endDate: true } }),
    prisma.undatedEmployment.findMany({ where: { candidateId, companyId: { not: null } }, select: { companyId: true, isCurrent: true, endDate: true } }),
    prisma.companyCultureResponse.findMany({ where: { candidateId } }),
  ])
  const jobs = new Map<string, { isCurrent: boolean; endedAt: Date | null }>()
  for (const j of [...employment, ...work, ...undated]) {
    const prev = jobs.get(j.companyId!)
    const isCurrent = (prev?.isCurrent ?? false) || j.isCurrent
    const endedAt = isCurrent ? null : [prev?.endedAt, j.endDate].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
    jobs.set(j.companyId!, { isCurrent, endedAt })
  }
  if (jobs.size === 0) return []
  const companies = await prisma.company.findMany({
    where: { id: { in: [...jobs.keys()] } },
    select: { id: true, name: true, canonicalNameNormalized: true },
  })
  const responseBy = new Map(responses.map((r) => [r.companyId, r]))
  return companies
    .map((c) => {
      const j = jobs.get(c.id)!
      const r = responseBy.get(c.id)
      return {
        companyId: c.id,
        companyName: c.name,
        slug: c.canonicalNameNormalized,
        isCurrent: j.isCurrent,
        tenureEndedAt: j.endedAt,
        answers: r ? answersOf(r) : null,
      }
    })
    .sort((a, b) => Number(a.isCurrent) - Number(b.isCurrent) || (b.tenureEndedAt?.getTime() ?? 0) - (a.tenureEndedAt?.getTime() ?? 0))
}

/** Save (create or update) one member's answers for one company they worked at. */
export async function saveCultureResponse(
  candidateId: string,
  companyId: string,
  answers: Partial<Record<CultureDimensionKey, number>>
): Promise<{ ok: true; isCurrent: boolean } | { ok: false; error: string }> {
  const eligible = (await getCultureSurveyCompanies(candidateId)).find((c) => c.companyId === companyId)
  if (!eligible) return { ok: false, error: "We can only take answers about companies on your work history. Add this job to your resume or work history first." }
  const data = { ...Object.fromEntries(CULTURE_KEYS.map((k) => [k, answers[k] ?? null])), isCurrent: eligible.isCurrent, tenureEndedAt: eligible.tenureEndedAt }
  await prisma.companyCultureResponse.upsert({
    where: { companyId_candidateId: { companyId, candidateId } },
    create: { companyId, candidateId, ...data },
    update: data,
  })
  return { ok: true, isCurrent: eligible.isCurrent }
}

// ── The member's own preferences ─────────────────────────────────────────────

export async function getCulturePreferences(candidateId: string): Promise<CultureAnswers | null> {
  const row = await prisma.candidateCulturePreference.findUnique({ where: { candidateId } })
  if (!row) return null
  const { pace, structure, workLife, decisions, managerSupport, mission, growth } = row
  return { pace, structure, workLife, decisions, managerSupport, mission, growth }
}
