// Fixture: Danforth — mid-tier (SENIOR band) revenue leader with real
// dollar/quota metrics. Paired with hollander.ts for Master Build Script
// §16 gate 8 ("function fairness"): bullet shape (from/to pairs, one per
// bullet) deliberately mirrors hollander.ts exactly, so
// outcomeRatio/baselineRatio/numberDensity — and therefore the
// Quantification dimension score — come out identical between the two.
// Scope (quota) is deliberately smaller than Hollander's headcount-derived
// scope so gate 1's ordering (Hollander > Danforth on Your Experience)
// holds for a real, legitimate reason (a smaller org), not because revenue
// metrics were penalized.

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'

export const danforthFacts: ResumeAnalysisFacts = {
  roles: [
    {
      title: 'Director of Sales',
      company: 'Ferro Analytics Corp',
      startDate: '2017-01-01',
      endDate: '2020-06-30',
      isCurrent: false,
      isInternship: false,
      budgetOrPnlUsd: null,
      headcount: 40,
      quotaUsd: 3_000_000,
      quotaAttainmentPct: 108,
      geographyScope: 'North America',
      reportingLine: 'reports to VP Sales',
      industry: 'software',
      bullets: [
        {
          text: 'Grew regional annual recurring revenue from $1.5M to $3M over three years.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Increased personal quota attainment from 94% to 108% year over year.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Grew the regional sales team from 12 to 40 people across three regions.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
    {
      title: 'VP of Sales',
      company: 'Ferro Analytics Corp',
      startDate: '2020-07-01',
      endDate: null,
      isCurrent: true,
      isInternship: false,
      budgetOrPnlUsd: null,
      headcount: 150,
      quotaUsd: 11_000_000,
      quotaAttainmentPct: 118,
      geographyScope: 'North America and EMEA',
      reportingLine: 'reports to CRO',
      industry: 'software',
      bullets: [
        {
          text: 'Scaled annual recurring revenue from $3M to $11M in four years, expanding into EMEA.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Reduced average sales cycle from 96 to 61 days by restructuring the qualification process.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Grew the sales organization from 40 to 150 people while improving net revenue retention from 92% to 108%.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
  ],
  education: [
    {
      schoolName: 'Millbrook College',
      degree: 'BA',
      fieldOfStudy: 'Business Administration',
      graduationDate: '2013-05-15',
      hasGrantingInstitution: true,
    },
  ],
  extracurricular: [
    {
      organization: 'Sales Leadership Alliance',
      role: 'Chapter Lead',
      kind: 'ASSOCIATION_LEADERSHIP',
      isCurrent: true,
    },
  ],
  hasEmail: true,
  hasPhone: true,
  hasLinkedIn: true,
  hasLocation: true,
  candidateName: 'Renata Danforth',
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
  narrativePositioningRationale: 'States a clear VP of Sales / Head of Revenue target at growth-stage SaaS companies.',
  mechanicsPresentationScore: 82,
  currentTerminologyFound: ['pipeline coverage', 'net revenue retention'],
  staleTerminologyFound: [],
  topOfDocumentClear: true,
  mostRecentRoleLegibleAtGlance: true,
  trajectoryApparentAtGlance: true,
  visualScanability: 80,
}
