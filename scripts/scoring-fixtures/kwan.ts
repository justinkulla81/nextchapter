// Fixture: Kwan — strong executive candidate, elite pedigree, real
// EVP -> President scope increase (Master Build Script §16 gates 1-5).
//
// Institution ("Radcliffe Endowed University") and employer ("Vantage
// Meridian Group") names are fictional but deliberately match the mock
// EliteInstitution/PrestigeEmployer rows the test file supplies via
// vi.mock('@/lib/prisma') — see src/test/scoring-fixtures.test.ts. Kwan is
// designed to sit at the top of the field on Your Experience (gate 1) and
// to carry real prestige signal so zeroing it can be checked against a
// one-band cap (gate 3).
//
// solano.ts derives from this file via structuredClone + targeted overrides
// (company/school names only) to satisfy gate 2 (logo isolation) by
// construction rather than by coincidence.

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'

export const kwanFacts: ResumeAnalysisFacts = {
  roles: [
    {
      title: 'Senior Vice President, Merchandising',
      company: 'Alderbrook Consumer Holdings',
      startDate: '2014-02-01',
      endDate: '2018-12-31',
      isCurrent: false,
      isInternship: false,
      budgetOrPnlUsd: 90_000_000,
      headcount: 400,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: 'North America',
      reportingLine: 'reports to EVP, Merchandising',
      industry: 'consumer retail',
      bullets: [
        {
          text: 'Grew private-label gross margin from 28% to 36% over four years by renegotiating vendor terms across the top 40 SKUs.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Built and led a 400-person merchandising organization spanning apparel, home, and seasonal categories.',
          isOutcomeNotActivity: true,
          hasBaselinePair: false,
          hasAnyNumber: true,
        },
        {
          text: 'Launched a private-label program that reached $90M in annual revenue within three years of inception.',
          isOutcomeNotActivity: true,
          hasBaselinePair: false,
          hasAnyNumber: true,
        },
      ],
    },
    {
      title: 'Executive Vice President, Global Operations',
      company: 'Vantage Meridian Group',
      startDate: '2019-01-01',
      endDate: '2022-06-30',
      isCurrent: false,
      isInternship: false,
      budgetOrPnlUsd: 210_000_000,
      headcount: 1_100,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: 'North America and EMEA',
      reportingLine: 'reports to President',
      industry: 'consumer retail',
      bullets: [
        {
          text: 'Scaled the operating P&L from $140M to $210M while expanding into EMEA, opening 60 new stores in 18 months.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Cut supply chain cost per unit from $4.10 to $3.35 by consolidating three regional distribution networks into one.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Grew the global operations team from 650 to 1,100 people across four countries.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
    {
      title: 'President',
      company: 'Vantage Meridian Group',
      startDate: '2022-07-01',
      endDate: null,
      isCurrent: true,
      isInternship: false,
      budgetOrPnlUsd: 480_000_000,
      headcount: 2_400,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: 'North America, EMEA, and APAC',
      reportingLine: 'reports to CEO',
      industry: 'consumer retail',
      bullets: [
        {
          text: 'Took full P&L ownership from $210M to $480M in three years, adding an APAC region from a standing start.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Grew the organization from 1,100 to 2,400 people while holding SG&A flat as a percentage of revenue.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          text: 'Sit on the CEO\'s five-person executive committee; own the annual operating plan presented to the board.',
          isOutcomeNotActivity: true,
          hasBaselinePair: false,
          hasAnyNumber: true,
        },
      ],
    },
  ],
  education: [
    {
      schoolName: 'Radcliffe Endowed University',
      degree: 'MBA',
      fieldOfStudy: 'Finance',
      graduationDate: '2013-05-15',
      hasGrantingInstitution: true,
    },
    {
      schoolName: 'Continental State University',
      degree: 'BA',
      fieldOfStudy: 'Economics',
      graduationDate: '2008-05-15',
      hasGrantingInstitution: true,
    },
  ],
  extracurricular: [
    {
      organization: 'National Retail Federation',
      role: 'Board Member',
      kind: 'BOARD_SEAT',
      isCurrent: true,
    },
  ],
  hasEmail: true,
  hasPhone: true,
  hasLinkedIn: true,
  hasLocation: true,
  candidateName: 'Priya Kwan',
  emailNameMismatch: false,
  statedYearsExperience: 12,
  summaryClaimsOverlapWithTimeline: true,
  seniorityLevelStated: 'President',
  mechanicsIssues: [],
  atsFlags: [],
  hasSummary: true,
  summaryIsForwardLooking: true,
  targetStatedOrInferable: true,
  narrativePositioningScore: 92,
  narrativePositioningRationale: 'Clear forward-looking summary naming CEO/President-track targets at consumer companies $500M-$2B in revenue.',
  mechanicsPresentationScore: 93,
  currentTerminologyFound: ['omnichannel', 'P&L ownership', 'org design'],
  staleTerminologyFound: [],
  topOfDocumentClear: true,
  mostRecentRoleLegibleAtGlance: true,
  trajectoryApparentAtGlance: true,
  visualScanability: 90,
}
