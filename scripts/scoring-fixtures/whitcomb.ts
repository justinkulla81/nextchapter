// Fixture: Whitcomb — early-career, one-page, thin extracurricular content
// (Master Build Script §16 gates 1, 5, 7, 9).
//
// Deliberately contains exactly three real, fixable issues, each traceable
// to one Finding the engine actually produces today:
//   1. A pure "duty, not result" bullet with no number at all (role 0,
//      bullet 0) -> scoreQuantification's HIGH "describes a duty, not a
//      result" finding.
//   2. No stated/inferable target -> scoreNarrativePositioning's HIGH
//      "records what you've done but never says what you want next"
//      finding.
//   3. A literal typo ("quaterly") in the current role's second bullet ->
//      scoreMechanicsPresentation's HIGH TYPO finding.
// whitcombFixedFacts (below) applies exactly these three fixes and nothing
// else — same roles, same dates, same scope numbers, same everything but
// the three specific things each finding's `fix` field describes. Gate 7
// (release blocker) recomputes both and asserts the band moves.
//
// Scope is deliberately modest ($120K program budget, no headcount owned)
// but non-zero and consistent with SCOPE_BAND_NORM.EARLY ($100K) — proving
// gate 9 (band fairness): an early-career candidate isn't crushed by the
// same $30M+ bar an executive is held to. Tenure on both roles clears the
// 18-month MARKETING short-tenure threshold, so nothing here is penalized
// for being new to the workforce — only for the three concrete, fixable
// issues above.

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'

export const whitcombFacts: ResumeAnalysisFacts = {
  roles: [
    {
      title: 'Marketing Coordinator',
      company: 'Bright Peak Media',
      startDate: '2021-06-01',
      endDate: '2023-05-31',
      isCurrent: false,
      isInternship: false,
      budgetOrPnlUsd: null,
      headcount: null,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: null,
      reportingLine: 'reports to Marketing Director',
      industry: 'media',
      bullets: [
        {
          // The deliberate "activity, not outcome" bullet — fix #1.
          text: "Managed the company's social media content calendar and coordinated with the design team on asset requests.",
          isOutcomeNotActivity: false,
          hasBaselinePair: false,
          hasAnyNumber: false,
        },
      ],
    },
    {
      title: 'Marketing Analyst',
      company: 'Bright Peak Media',
      startDate: '2023-06-01',
      endDate: null,
      isCurrent: true,
      isInternship: false,
      budgetOrPnlUsd: 120_000,
      headcount: null,
      quotaUsd: null,
      quotaAttainmentPct: null,
      geographyScope: 'Northeast U.S.',
      reportingLine: 'reports to Marketing Director',
      industry: 'media',
      bullets: [
        {
          text: 'Assisted with paid social campaigns across three channels.',
          isOutcomeNotActivity: false,
          hasBaselinePair: false,
          hasAnyNumber: false,
        },
        {
          // The deliberate typo ("quaterly") — fix #3.
          text: 'Grew paid social leads from 12,000 to 40,000 per quaterly cycle on a $120,000 quaterly budget.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
  ],
  education: [
    {
      schoolName: 'Coastal Ridge University',
      degree: 'BA',
      fieldOfStudy: 'Communications',
      graduationDate: '2021-05-15',
      hasGrantingInstitution: true,
    },
  ],
  extracurricular: [
    {
      organization: 'Local Young Professionals Network',
      role: 'Volunteer Coordinator',
      kind: 'VOLUNTEER_LEADERSHIP',
      isCurrent: true,
    },
  ],
  hasEmail: true,
  hasPhone: true,
  hasLinkedIn: true,
  hasLocation: true,
  candidateName: 'Jordan Whitcomb',
  emailNameMismatch: false,
  statedYearsExperience: 5,
  summaryClaimsOverlapWithTimeline: true,
  seniorityLevelStated: null,
  // Fix #3's target — the literal typo.
  mechanicsIssues: [
    {
      kind: 'TYPO',
      quote: '$120,000 quaterly budget',
      location: 'most recent role, bullet 2',
    },
  ],
  atsFlags: [],
  hasSummary: false,
  summaryIsForwardLooking: false,
  // Fix #2's target — no stated/inferable target.
  targetStatedOrInferable: false,
  narrativePositioningScore: 35,
  narrativePositioningRationale: 'No summary and no stated target — reads as a record of past duties with no forward-looking thesis.',
  mechanicsPresentationScore: 55,
  currentTerminologyFound: [],
  staleTerminologyFound: [],
  topOfDocumentClear: true,
  mostRecentRoleLegibleAtGlance: true,
  trajectoryApparentAtGlance: false,
  visualScanability: 72,
}

// Applies exactly the three fixes above and nothing else — see the file
// header. Used by gate 7 (release blocker).
export const whitcombFixedFacts: ResumeAnalysisFacts = {
  ...structuredClone(whitcombFacts),
  roles: [
    {
      ...structuredClone(whitcombFacts.roles[0]),
      bullets: [
        {
          // Fix #1 applied: now a quantified outcome bullet.
          text: 'Grew organic social engagement from 4% to 9% by overhauling the content calendar and streamlining asset requests with the design team.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
    {
      ...structuredClone(whitcombFacts.roles[1]),
      bullets: [
        {
          text: 'Grew paid social leads from 9,000 to 22,000 per month across three channels.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
        {
          // Fix #3 applied: typo corrected.
          text: 'Grew paid social leads from 12,000 to 40,000 per quarterly cycle on a $120,000 quarterly budget.',
          isOutcomeNotActivity: true,
          hasBaselinePair: true,
          hasAnyNumber: true,
        },
      ],
    },
  ],
  // Fix #3 applied: the typo finding's source issue is gone.
  mechanicsIssues: [],
  mechanicsPresentationScore: 70,
  // Fix #2 applied: a real target line was added.
  hasSummary: true,
  summaryIsForwardLooking: true,
  targetStatedOrInferable: true,
  narrativePositioningScore: 75,
  narrativePositioningRationale: 'A clear one-line target (Marketing Manager, consumer media, Northeast) now sits under the header, forward-looking.',
}
