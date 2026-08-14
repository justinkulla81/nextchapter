// Fixture: Hollander — mid-tier (SENIOR band) engineering leader with zero
// revenue/dollar metrics, only technical/output metrics (latency, uptime,
// cost-per-user, headcount). Paired with danforth.ts for Master Build
// Script §16 gate 8 ("function fairness"): every bullet here is written as
// an explicit from/to pair, exactly mirroring danforth.ts's bullet shape,
// so scoreQuantification's outcomeRatio/baselineRatio/numberDensity come
// out identical between the two fixtures — proving the engineering
// candidate isn't penalized for lacking revenue numbers he'd have no
// legitimate way to report.
//
// Scope (headcount) is deliberately set slightly larger than Danforth's so
// the two aren't required to tie on Your Experience overall (gate 1 only
// requires Hollander > Danforth there) — the fairness claim is scoped to
// the Quantification dimension specifically, not to every dimension.

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'

export const hollanderFacts: ResumeAnalysisFacts = {
  roles: [
    {
      title: 'Director of Engineering',
      company: 'Fenwick Systems Inc',
      startDate: '2017-01-01',
      endDate: '2020-06-30',
      isCurrent: false,
      isInternship: false,
      budgetOrPnlUsd: null,
      headcount: 60,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: 'North America',
      reportingLine: 'reports to VP Engineering',
      industry: 'software',
      bullets: [
        {
          text: 'Reduced p95 API latency from 420ms to 110ms by re-architecting the request pipeline.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Scaled the platform from 2M to 18M monthly active users without a major incident.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Grew the engineering org from 22 to 60 engineers across three time zones.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
    {
      title: 'VP of Engineering',
      company: 'Fenwick Systems Inc',
      startDate: '2020-07-01',
      endDate: null,
      isCurrent: true,
      isInternship: false,
      budgetOrPnlUsd: null,
      headcount: 230,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: 'North America and EMEA',
      reportingLine: 'reports to CTO',
      industry: 'software',
      bullets: [
        {
          text: 'Improved platform uptime from 99.5% to 99.97% by building an incident-response program from scratch.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Cut infrastructure cost per active user from $0.42 to $0.19 through a multi-region re-platforming effort.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Grew engineering headcount from 60 to 230 while holding annual attrition under 8%.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
  ],
  education: [
    {
      schoolName: 'Bellweather Institute of Technology',
      degree: 'BS',
      fieldOfStudy: 'Computer Science',
      graduationDate: '2013-05-15',
      hasGrantingInstitution: true,
    },
  ],
  extracurricular: [
    {
      organization: 'Open Source Foundation',
      role: 'Maintainer',
      kind: 'VOLUNTEER_LEADERSHIP',
      isCurrent: true,
    },
  ],
  hasEmail: true,
  hasPhone: true,
  hasLinkedIn: true,
  hasLocation: true,
  candidateName: 'Devon Hollander',
  emailNameMismatch: false,
  statedYearsExperience: 9,
  summaryClaimsOverlapWithTimeline: true,
  seniorityLevelStated: 'VP',
  mechanicsIssues: [],
  atsFlags: [],
  hasSummary: true,
  summaryIsForwardLooking: true,
  targetStatedOrInferable: true,
  narrativePositioningScore: 78,
  narrativePositioningRationale: 'States a clear VP/Head of Engineering target at growth-stage SaaS companies.',
  mechanicsPresentationScore: 82,
  currentTerminologyFound: ['platform reliability', 'distributed systems'],
  staleTerminologyFound: [],
  topOfDocumentClear: true,
  mostRecentRoleLegibleAtGlance: true,
  trajectoryApparentAtGlance: true,
  visualScanability: 80,
}
