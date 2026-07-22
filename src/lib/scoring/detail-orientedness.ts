import type { CandidateProfile } from '@prisma/client'

// Measures how many of the explicitly-optional "job search activity"
// questions (CircumstancesForm's Part 1 block — see prisma/schema.prisma)
// the candidate actually answered. Skipping them isn't neutral: it's the
// same thoroughness a hiring manager judges in a sparse resume or a
// half-filled application, so it scores as a real Market Reality dimension
// rather than a silent gap.
export function computeDetailOrientednessScore(
  candidate: Pick<
    CandidateProfile,
    | 'jobsAppliedBucket'
    | 'interviewsReceivedCount'
    | 'networkingLevel'
    | 'learnedNewSkillsLevel'
    | 'triedPartTimeOrConsulting'
    | 'triedExecutiveCoaching'
    | 'connectedWithRecruiters'
    | 'recruiterConnectionCount'
  >
): number {
  const fields: (string | number | boolean | null)[] = [
    candidate.jobsAppliedBucket,
    candidate.interviewsReceivedCount,
    candidate.networkingLevel,
    candidate.learnedNewSkillsLevel,
    candidate.triedPartTimeOrConsulting,
    candidate.triedExecutiveCoaching,
    candidate.connectedWithRecruiters,
  ]
  // recruiterConnectionCount only counts as an available question once the
  // candidate has said yes to connecting with recruiters — it isn't shown
  // otherwise, so it shouldn't count against someone who never saw it.
  if (candidate.connectedWithRecruiters === true) {
    fields.push(candidate.recruiterConnectionCount)
  }

  const answered = fields.filter((f) => f !== null && f !== undefined).length
  const ratio = answered / fields.length
  return Math.round(ratio * 100)
}
