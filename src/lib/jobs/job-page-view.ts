import 'server-only'
import type { ExclusiveJobPosting } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { loadStrengths } from '@/lib/profile/strengths-load'
import { strengthKeys } from '@/lib/profile/strengths'
import { isLocationInArea, localAreaForCandidate } from '@/lib/workforce/local'
import { loadWorkProfile } from '@/lib/profile/work-profile-load'
import { resolveCompanySizeBands } from '@/lib/market/company-size'
import { bucketFromAssessment, computeFitAssessment } from '@/lib/jobs/job-fit-bucket'
import { matchJobToCandidate, toMatchJob } from '@/lib/jobs/job-match'
import { getCulturePreferences, getCultureProfiles } from '@/lib/companies/culture-profile'
import { jobSkillGap } from '@/lib/jobs/job-skill-gap'
import { memberSkillKeywords } from '@/lib/jobs/skill-gap-data'
import { loadSkillsFit } from '@/lib/careers/skills-fit-server'
import { loadJobContacts } from '@/lib/jobs/job-contacts'
import { employerSignalsFor } from '@/lib/jobs/great-employers'
import { loadJobBenefits, loadPayHighCompanies } from '@/lib/jobs/great-employers-data'
import { isExplainGapsEnabled } from '@/lib/jobs/explain-gaps'
import { applicationStatus } from '@/lib/jobs/my-jobs'
import { cardVerdict, levelPhrase } from '@/lib/jobs/job-card'
import { fewerApplicantsHint, isFresh, postedAgo, scoreCompetition } from '@/lib/jobs/competition'
import { listItemOf, nextStepFor, oneFact } from '@/lib/jobs/find-list'
import { whyThisJob } from '@/lib/personalization/why-this-job'
import { classifyWorkType, payBasisLabel } from '@/lib/jobs/work-type'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { countInsidersByCompany, hasTaggedEmployment } from '@/lib/companies/insider-network'
import { getCandidateMarketIntelTier, tierMeetsFeature } from '@/lib/market-intelligence/access'
import type { FindJobDetailProps } from '@/components/dashboard/find/FindJobDetail'

type Profile = Awaited<ReturnType<typeof getDashboardData>>

/**
 * Everything a job's own page needs to show the same open-job pane as Find a job: the member's fit, the
 * match and gaps, the next step, their save / applied state and the employer signals. It is the board's
 * own computation for ONE job (the same helpers, the same inputs), so the page and the list never
 * disagree about a job. Any part that fails is left out rather than failing the page.
 */
export async function loadJobPageView(profile: Profile, posting: ExclusiveJobPosting, candidatePlus: boolean): Promise<FindJobDetailProps> {
  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const soft = <T,>(p: Promise<T>, what: string): Promise<T | null> =>
    p.catch((error) => {
      console.error(`Job page: ${what} unavailable:`, error)
      return null
    })
  const memberKeywords = memberSkillKeywords(profile)
  const [bands, company, culturePrefs, workProfile, strengthKeysNow, area, tracked, watch, payHigh, benefits, openAtCompany, contactsMap, skillsFitFor] = await Promise.all([
    posting.companyName ? resolveCompanySizeBands([posting.companyName]) : Promise.resolve([{ band: null }]),
    posting.companyId ? prisma.company.findUnique({ where: { id: posting.companyId }, select: { id: true, sizeBand: true, ownershipType: true, canonicalNameNormalized: true } }) : Promise.resolve(null),
    soft(getCulturePreferences(profile.id), 'culture preferences'),
    soft(loadWorkProfile(profile.id), 'work profile'),
    soft(loadStrengths(profile.id).then(strengthKeys), 'strengths'),
    soft(localAreaForCandidate(profile.id), 'local area'),
    prisma.trackedJob.findFirst({ where: { candidateId: profile.id, source: 'job_board', sourceId: posting.id }, include: { jobPosting: true } }),
    posting.companyName ? prisma.companyWatchlistEntry.findFirst({ where: { candidateId: profile.id, companyNameNormalized: normalizeOrgName(posting.companyName) }, select: { id: true } }) : Promise.resolve(null),
    soft(loadPayHighCompanies(), 'employer pay'),
    soft(loadJobBenefits([posting.id]), 'benefits'),
    posting.companyId ? prisma.exclusiveJobPosting.count({ where: { companyId: posting.companyId, status: 'approved' } }) : Promise.resolve(0),
    soft(loadJobContacts([posting], profile.id), 'contacts'),
    soft(loadSkillsFit(profile.id, memberKeywords), 'skills fit'),
  ])
  const sizeBand = company?.sizeBand ?? bands[0]?.band ?? null
  const local = area ? { label: area.label, isLocal: (loc: string | null) => isLocationInArea(area, loc) } : null
  const cultureProfiles = !confidential && posting.companyId ? await soft(getCultureProfiles([posting.companyId], profile.id), 'culture') : null

  const assessment = computeFitAssessment(profile, { ...posting, companySizeBand: sizeBand })
  const fitBucket = bucketFromAssessment(assessment)
  const match = matchJobToCandidate(
    { ...profile, culturePrefs, workProfile, strengthKeys: strengthKeysNow, local },
    toMatchJob(posting, {
      sizeBand,
      ownershipType: company?.ownershipType ?? null,
      insiderCulture: posting.companyId && !confidential ? (cultureProfiles?.get(posting.companyId) ?? null) : null,
    })
  )
  const gap = jobSkillGap({ title: posting.title, description: posting.description, skills: posting.skills, aiSkillItems: posting.aiSkillItems, memberKeywords })
  const competition = scoreCompetition(posting, openAtCompany)
  const why = whyThisJob({
    jobRemote: (posting.targetRemotePolicy ?? '').toLowerCase() === 'remote' || statesFromLocation(posting.location).isRemote,
    city: null,
    hasIndustries: false,
    have: gap.have,
    missing: gap.missing,
    blocker: match.requirements.find((r) => r.status === 'blocker')?.label ?? null,
    level: levelPhrase(assessment.level),
  })
  const workType = classifyWorkType(posting)
  const item = listItemOf({
    id: posting.id,
    kind: 'board',
    title: posting.title,
    companyName: posting.companyName,
    confidential,
    place: posting.location,
    verdict: cardVerdict(fitBucket),
    why,
    fact: oneFact({ posted: postedAgo(posting), fewerApplicants: fewerApplicantsHint(competition), pay: payBasisLabel({ ...posting, workType }) }),
  })

  // Members who worked at this company (Plus Market Intelligence), the same gate as the company page.
  let insiders: { count: number; href: string } | undefined
  if (company && !confidential) {
    const gated = await soft(Promise.all([hasTaggedEmployment(profile.id), getCandidateMarketIntelTier(profile.id)]).then(([tagged, tier]) => tagged && tierMeetsFeature(tier, 'insider_network')), 'insider gate')
    if (gated) {
      const counts = await soft(countInsidersByCompany([company.id], profile.id), 'insiders')
      const count = counts?.get(company.id) ?? 0
      if (count > 0) insiders = { count, href: `/dashboard/companies/${encodeURIComponent(company.canonicalNameNormalized)}#insiders` }
    }
  }
  const contacts = contactsMap?.get(posting.id)
  const status = applicationStatus(tracked?.jobPosting)
  return {
    posting,
    item,
    fitBucket,
    nextStep: nextStepFor({
      blocker: match.requirements.find((r) => r.status === 'blocker')?.label ?? null,
      contactName: confidential ? null : (contacts?.known[0]?.name ?? null),
      insiderCount: insiders?.count ?? 0,
      fresh: isFresh(posting),
    }),
    competition,
    contacts,
    skillGap: gap,
    skillsFit: skillsFitFor?.(posting.title) ?? undefined,
    match,
    explainGapsEnabled: isExplainGapsEnabled(),
    insiders,
    track: tracked ? { saved: !!tracked.savedAt, status } : undefined,
    watched: !!watch,
    employer: confidential ? undefined : employerSignalsFor(posting.companyName, payHigh ?? new Set()),
    benefits: benefits?.get(posting.id),
    candidatePlus,
  }
}
